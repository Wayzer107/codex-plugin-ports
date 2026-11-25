---
name: ratatui-patterns
description: "Use when building terminal user interfaces with ratatui — covers app architecture (Elm/TEA), async event loops with crossterm EventStream, PTY rendering with tui-term, terminal pane management, color theming, snapshot testing, and co-running with HTTP servers like axum.\n"
---

# Ratatui Patterns

Build terminal UIs in Rust with ratatui 0.30+. Covers the patterns that matter for production TUI apps — not the basics from the tutorial.

## When to Use

- Building a TUI application with ratatui
- Embedding a TUI alongside an HTTP server (axum) in a single binary
- Rendering PTY output inside ratatui (terminal multiplexer, session viewer)
- Designing keyboard navigation and pane management

## App Architecture — Elm Architecture (TEA)

Ratatui is immediate-mode: every frame redraws from state. The Elm Architecture fits naturally.

```rust
// Model — all app state in one struct
struct App {
    view: View,
    sessions: Vec<Session>,
    selected: usize,
    input: String,
    should_quit: bool,
}

// Message — all possible state transitions
enum Message {
    Key(KeyEvent),
    SessionUpdated(Session),
    OutputReceived(String, Vec<u8>),
    Tick,
    Quit,
}

// Update — pure state transition
fn update(app: &mut App, msg: Message) {
    match msg {
        Message::Key(key) => handle_key(app, key),
        Message::SessionUpdated(s) => update_session(app, s),
        Message::Quit => app.should_quit = true,
        // ...
    }
}

// View — pure rendering, no side effects
fn view(app: &App, frame: &mut Frame) {
    match app.view {
        View::SessionList => render_session_list(app, frame),
        View::Chat => render_chat(app, frame),
        View::Terminal => render_terminal_panes(app, frame),
    }
}
```

**Rules:**
- View functions never mutate state
- Update functions never call ratatui — they only change `App`
- All I/O happens outside the Model/Update/View cycle

## Async Event Loop with Tokio

Run the TUI as the main async task. Use `tokio::select!` to multiplex events.

```rust
use ratatui::crossterm::event::{EventStream, Event};
use futures::StreamExt;
use tokio_util::sync::CancellationToken;

async fn run_tui(
    mut terminal: DefaultTerminal,
    cancel: CancellationToken,
    mut state_rx: tokio::sync::watch::Receiver<AppState>,
    cmd_tx: tokio::sync::mpsc::Sender<Command>,
) -> color_eyre::Result<()> {
    let mut events = EventStream::new();
    let mut tick = tokio::time::interval(Duration::from_millis(33)); // 30fps

    loop {
        tokio::select! {
            Some(Ok(event)) = events.next() => {
                if let Event::Key(key) = event {
                    update(&mut app, Message::Key(key));
                }
            }
            _ = tick.tick() => {
                terminal.draw(|frame| view(&app, frame))?;
            }
            Ok(()) = state_rx.changed() => {
                let state = state_rx.borrow().clone();
                update(&mut app, Message::StateChanged(state));
            }
            _ = cancel.cancelled() => { break; }
        }
        if app.should_quit { break; }
    }
    Ok(())
}
```

**Do NOT use:**
- `std::thread::spawn` for the TUI loop — loses tokio integration
- `tokio::task::spawn_blocking` — permanently consumes a thread pool slot, cannot be aborted
- Synchronous `crossterm::event::read()` in async context — blocks the runtime

## Co-Running with Axum

A single `#[tokio::main]` runs both TUI and HTTP server:

```rust
#[tokio::main]
async fn main() -> color_eyre::Result<()> {
    color_eyre::install()?;
    let terminal = ratatui::init();

    let cancel = CancellationToken::new();

    // Spawn axum on a background task
    let server_cancel = cancel.clone();
    tokio::spawn(async move {
        let app = Router::new().route("/events", post(handle_events));
        let listener = TcpListener::bind("0.0.0.0:8000").await.unwrap();
        axum::serve(listener, app)
            .with_graceful_shutdown(server_cancel.cancelled_owned())
            .await
            .unwrap();
    });

    // TUI runs as main task
    let result = run_tui(terminal, cancel.clone(), state_rx, cmd_tx).await;

    cancel.cancel(); // signal all tasks
    ratatui::restore();
    result
}
```

**Key points:**
- `ratatui::init()` sets up raw mode, alternate screen, AND panic hooks
- `ratatui::restore()` tears everything down (call after TUI loop exits)
- `cancel.cancel()` triggers graceful shutdown of axum and all background tasks
- Install `color_eyre` BEFORE `ratatui::init()`

## Communication Channels

| Channel | Direction | Use |
|---------|-----------|-----|
| `watch` | Background → TUI | State updates. TUI reads latest value each tick — skips intermediate states (correct for UI) |
| `mpsc` | TUI → Background | Commands (spawn session, send input). Ordered, every message delivered |
| `CancellationToken` | Bidirectional | Coordinated shutdown |

## PTY Rendering with tui-term

Render raw PTY output inside ratatui using `tui-term` (backed by `vt100`).

```rust
use tui_term::widget::PseudoTerminal;
use tui_term::vt100; // re-exported, don't add vt100 separately

// Create parser sized to widget area
let parser = Arc::new(RwLock::new(vt100::Parser::new(rows, cols, 1000)));

// Background task feeds PTY bytes
let p = parser.clone();
tokio::spawn(async move {
    while let Some(bytes) = output_rx.recv().await {
        p.write().unwrap().process(&bytes);
    }
});

// Render in view function
fn render_terminal(parser: &RwLock<vt100::Parser>, frame: &mut Frame, area: Rect) {
    let screen = parser.read().unwrap();
    let pseudo_term = PseudoTerminal::new(screen.screen())
        .block(Block::bordered().title("Session"));
    frame.render_widget(pseudo_term, area);
}
```

**On pane resize:** Create a new `vt100::Parser` with updated dimensions. The old parser's scrollback is lost — this is acceptable for live terminal output.

## Terminal Pane Management

Split the terminal area using ratatui's `Layout`:

```rust
fn render_panes(app: &App, frame: &mut Frame, area: Rect) {
    let chunks = match app.panes.len() {
        1 => vec![area],
        2 => Layout::horizontal([Constraint::Percentage(50); 2]).split(area).to_vec(),
        3 | 4 => {
            let rows = Layout::vertical([Constraint::Percentage(50); 2]).split(area);
            let top = Layout::horizontal([Constraint::Percentage(50); 2]).split(rows[0]);
            let bot = Layout::horizontal([Constraint::Percentage(50); 2]).split(rows[1]);
            [top[0], top[1], bot[0], bot[1]][..app.panes.len()].to_vec()
        }
        _ => vec![area],
    };

    for (i, (chunk, pane)) in chunks.iter().zip(&app.panes).enumerate() {
        let is_active = i == app.active_pane;
        let border_style = if is_active {
            Style::new().fg(Color::Rgb(79, 195, 247)) // accent
        } else {
            Style::new().fg(Color::Rgb(37, 42, 58))   // border
        };
        // render pane with border_style...
    }
}
```

**Rules:**
- Max 4 panes (2x2 grid)
- At limit, new pane replaces active pane
- Minimum 40 columns per pane — collapse to single if terminal too narrow
- Minimum terminal size: 80x24

## Color Theming

Define all colors as constants using RGB:

```rust
pub mod theme {
    use ratatui::style::Color;

    pub const BG: Color = Color::Rgb(12, 14, 20);
    pub const SURFACE: Color = Color::Rgb(22, 25, 38);
    pub const BORDER: Color = Color::Rgb(37, 42, 58);
    pub const TEXT: Color = Color::Rgb(220, 224, 235);
    pub const TEXT_MUTED: Color = Color::Rgb(99, 107, 131);
    pub const ACCENT: Color = Color::Rgb(79, 195, 247);
    pub const SUCCESS: Color = Color::Rgb(102, 187, 106);
    pub const WARNING: Color = Color::Rgb(255, 167, 38);
    pub const ERROR: Color = Color::Rgb(239, 83, 80);
    pub const HIGHLIGHT: Color = Color::Rgb(171, 71, 188);
}
```

**Rule:** Every color is semantic. Never use raw RGB in view functions — always reference `theme::*`.

## Logging

Raw mode owns stdout/stderr. All logging must go to files.

```rust
use tracing_appender::rolling;
use tracing_subscriber::fmt;

let file_appender = rolling::daily("~/.vigil/logs", "vigil.log");
fmt::layer()
    .with_writer(file_appender)
    .with_ansi(false) // no ANSI in log files
    .init();
```

Never use `println!`, `eprintln!`, or `dbg!` — they corrupt the TUI.

## Snapshot Testing

Use `TestBackend` + `insta` for snapshot tests:

```rust
#[test]
fn test_session_list_render() {
    let app = App::with_test_data();
    let mut terminal = Terminal::new(TestBackend::new(80, 24)).unwrap();
    terminal.draw(|frame| view(&app, frame)).unwrap();
    insta::assert_snapshot!(terminal.backend());
}
```

**Limitations:** Snapshots capture text layout only, not colors. Test at multiple sizes (80x24, 120x40).

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Adding `crossterm` as separate dependency | Use `ratatui::crossterm` re-export |
| Using `spawn_blocking` for TUI loop | Use async `EventStream` with `tokio::select!` |
| Writing to stdout/stderr while TUI is active | Route all logging to files via `tracing-appender` |
| Forgetting `ratatui::restore()` on exit | Call after TUI loop, before process exit. `ratatui::init()` handles panics automatically |
| Hardcoding colors in view functions | Define all colors in `theme.rs` as constants |
| Blocking in the event loop | Every I/O operation must be async. Use channels for cross-task communication |
| Not handling terminal resize | Listen for `Event::Resize` in the event loop, recompute layouts |
