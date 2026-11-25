---
name: rails-patterns
description: "Use when building Ruby on Rails applications — covers convention over configuration, ActiveRecord, concerns, jobs, and testing."
---

## Overview

Ruby on Rails is an opinionated full-stack web framework that follows convention over configuration, providing ActiveRecord ORM, built-in testing, asset pipeline, and rapid development through generators.

## When to Use

- **Rails** -- Full-stack web apps with rapid prototyping, strong conventions, mature ecosystem
- **Sinatra** -- Minimal Ruby web apps or microservices
- **Django** -- Similar philosophy but in the Python ecosystem

## Core Patterns

### ActiveRecord Models

```ruby
class Article < ApplicationRecord
  belongs_to :author, class_name: "User"
  has_many :comments, dependent: :destroy
  has_many_attached :images

  validates :title, presence: true, length: { maximum: 200 }
  scope :published, -> { where.not(published_at: nil) }

  def publish!
    update!(published_at: Time.current)
  end
end
```

### Controllers and Strong Parameters

```ruby
class ArticlesController < ApplicationController
  before_action :authenticate_user!, except: [:index, :show]

  def create
    article = current_user.articles.build(article_params)
    if article.save
      render json: article, status: :created
    else
      render json: { errors: article.errors }, status: :unprocessable_entity
    end
  end

  private

  def article_params
    params.require(:article).permit(:title, :body, :category_id)
  end
end
```

### Concerns for Shared Behavior

```ruby
module Trackable
  extend ActiveSupport::Concern

  included do
    has_many :activity_logs, as: :trackable
    after_create :log_creation
  end

  def log_creation
    activity_logs.create!(action: "created")
  end
end
```

### Background Jobs

```ruby
class SendNotificationJob < ApplicationJob
  queue_as :default
  retry_on Net::OpenTimeout, wait: :polynomially_longer

  def perform(user, message)
    NotificationService.deliver(user, message)
  end
end
```

## Project Structure

```
app/
  controllers/       # Request handling
  models/            # ActiveRecord models
  views/             # ERB/Haml templates or Jbuilder
  services/          # Service objects (POROs)
  jobs/              # ActiveJob classes
  mailers/           # ActionMailer classes
config/
  routes.rb          # URL routing
  database.yml
db/
  migrate/           # Migration files
  schema.rb
spec/ or test/       # RSpec or Minitest
```

## Testing

```ruby
# RSpec example
RSpec.describe Article, type: :model do
  it "validates title presence" do
    article = build(:article, title: nil)
    expect(article).not_to be_valid
  end
end

RSpec.describe "Articles API", type: :request do
  it "creates an article" do
    post "/articles", params: { article: { title: "Hello" } },
         headers: auth_headers
    expect(response).to have_http_status(:created)
  end
end
```

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| N+1 queries | Use `.includes()` or `bullet` gem to detect |
| Fat controllers | Extract to service objects or form objects |
| Skipping database indexes | Add indexes on foreign keys and columns used in `where`/`order` |
| Not running `db:migrate` in CI | Include migration step in CI pipeline |
| Callbacks creating hidden side effects | Prefer explicit service objects over complex callback chains |

## Attribution

**Original** -- Datatide, MIT licensed.
