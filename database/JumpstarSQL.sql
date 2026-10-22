-- 1. USERS
CREATE TABLE [dbo].[users]
(
    [user_id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [username] NVARCHAR(30) NOT NULL UNIQUE,
    [email] NVARCHAR(255) NOT NULL UNIQUE,
    [password_hash] NVARCHAR(255) NOT NULL,
    [created_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [status] NVARCHAR(12) NOT NULL DEFAULT 'active',

    CONSTRAINT [chk_users_status]
        CHECK ([status] IN ('active', 'suspended', 'deleted'))
);

-- 2. PROFILES
CREATE TABLE [dbo].[profiles]
(
    [user_id] INT NOT NULL PRIMARY KEY,
    [display_name] NVARCHAR(60) NOT NULL,
    [bio] NVARCHAR(500) NULL,

    CONSTRAINT [fk_profiles_user]
        FOREIGN KEY ([user_id])
        REFERENCES [dbo].[users] ([user_id])
        ON DELETE CASCADE
);

-- 3. PROJECT CATEGORIES
CREATE TABLE [dbo].[project_categories]
(
    [category_id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [category_name] NVARCHAR(80) NOT NULL UNIQUE,
    [description] NVARCHAR(500) NULL
);

-- 4. PROJECTS
CREATE TABLE [dbo].[projects]
(
    [project_id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [owner_id] INT NOT NULL,
    [category_id] INT NULL,
    [project_name] NVARCHAR(120) NOT NULL,
    [description] NVARCHAR(2000) NOT NULL,
    [goal_hours] DECIMAL(7,2) NOT NULL,
    [status] NVARCHAR(15) NOT NULL DEFAULT 'open',
    [created_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT [chk_projects_goal_hours]
        CHECK ([goal_hours] > 0),

    CONSTRAINT [chk_projects_status]
        CHECK ([status] IN (
            'open', 'in_progress', 'completed', 'cancelled'
        )),

    CONSTRAINT [fk_projects_owner]
        FOREIGN KEY ([owner_id])
        REFERENCES [dbo].[users] ([user_id]),

    CONSTRAINT [fk_projects_category]
        FOREIGN KEY ([category_id])
        REFERENCES [dbo].[project_categories] ([category_id])
        ON DELETE SET NULL
);

-- 5. PROJECT FILES
CREATE TABLE [dbo].[project_files]
(
    [file_id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [project_id] INT NOT NULL,
    [uploaded_by] INT NOT NULL,
    [original_file_name] NVARCHAR(255) NOT NULL,
    [storage_name] NVARCHAR(500) NOT NULL UNIQUE,
    [content_type] NVARCHAR(100) NULL,
    [file_size_bytes] BIGINT NULL,
    [uploaded_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT [chk_project_files_size]
        CHECK (
            [file_size_bytes] IS NULL OR [file_size_bytes] >= 0
        ),

    CONSTRAINT [fk_project_files_project]
        FOREIGN KEY ([project_id])
        REFERENCES [dbo].[projects] ([project_id])
        ON DELETE CASCADE,

    CONSTRAINT [fk_project_files_uploader]
        FOREIGN KEY ([uploaded_by])
        REFERENCES [dbo].[users] ([user_id])
);

-- 6. PROJECT CONTRIBUTIONS
CREATE TABLE [dbo].[project_contributions]
(
    [contribution_id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [project_id] INT NOT NULL,
    [user_id] INT NOT NULL,
    [hours_committed] DECIMAL(7,2) NOT NULL,
    [hours_completed] DECIMAL(7,2) NOT NULL DEFAULT 0,
    [status] NVARCHAR(15) NOT NULL DEFAULT 'active',
    [committed_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT [chk_contributions_hours_committed]
        CHECK ([hours_committed] >= 0),

    CONSTRAINT [chk_contributions_hours_completed]
        CHECK ([hours_completed] >= 0),

    CONSTRAINT [chk_contributions_hours_limit]
        CHECK ([hours_completed] <= [hours_committed]),

    CONSTRAINT [chk_contributions_status]
        CHECK ([status] IN ('active', 'withdrawn', 'completed')),

    CONSTRAINT [fk_contributions_project]
        FOREIGN KEY ([project_id])
        REFERENCES [dbo].[projects] ([project_id])
        ON DELETE CASCADE,

    CONSTRAINT [fk_contributions_user]
        FOREIGN KEY ([user_id])
        REFERENCES [dbo].[users] ([user_id]),

    CONSTRAINT [uq_contributions_project_user]
        UNIQUE ([project_id], [user_id])
);

-- 7. CONTRIBUTION HISTORY
CREATE TABLE [dbo].[contribution_history]
(
    [history_id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [contribution_id] INT NOT NULL,
    [changed_by] INT NOT NULL,
    [hours_type] NVARCHAR(12) NOT NULL,
    [previous_hours] DECIMAL(7,2) NOT NULL,
    [new_hours] DECIMAL(7,2) NOT NULL,
    [changed_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [notes] NVARCHAR(500) NULL,

    CONSTRAINT [chk_contribution_history_hours_type]
        CHECK ([hours_type] IN ('committed', 'completed')),

    CONSTRAINT [chk_contribution_history_previous]
        CHECK ([previous_hours] >= 0),

    CONSTRAINT [chk_contribution_history_new]
        CHECK ([new_hours] >= 0),

    CONSTRAINT [fk_history_contribution]
        FOREIGN KEY ([contribution_id])
        REFERENCES [dbo].[project_contributions] ([contribution_id])
        ON DELETE CASCADE,

    CONSTRAINT [fk_history_changed_by]
        FOREIGN KEY ([changed_by])
        REFERENCES [dbo].[users] ([user_id])
);

-- 8. PROJECT UPVOTES
CREATE TABLE [dbo].[project_upvotes]
(
    [user_id] INT NOT NULL,
    [project_id] INT NOT NULL,
    [created_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT [pk_project_upvotes]
        PRIMARY KEY ([user_id], [project_id]),

    CONSTRAINT [fk_upvotes_user]
        FOREIGN KEY ([user_id])
        REFERENCES [dbo].[users] ([user_id])
        ON DELETE CASCADE,

    CONSTRAINT [fk_upvotes_project]
        FOREIGN KEY ([project_id])
        REFERENCES [dbo].[projects] ([project_id])
        ON DELETE CASCADE
);

-- 9. PROJECT COMMENTS
CREATE TABLE [dbo].[project_comments]
(
    [comment_id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [project_id] INT NOT NULL,
    [commenter_id] INT NOT NULL,
    [parent_comment_id] INT NULL,
    [comment_text] NVARCHAR(2000) NOT NULL,
    [created_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT [fk_comments_project]
        FOREIGN KEY ([project_id])
        REFERENCES [dbo].[projects] ([project_id])
        ON DELETE CASCADE,

    CONSTRAINT [fk_comments_commenter]
        FOREIGN KEY ([commenter_id])
        REFERENCES [dbo].[users] ([user_id]),

    CONSTRAINT [fk_comments_parent]
        FOREIGN KEY ([parent_comment_id])
        REFERENCES [dbo].[project_comments] ([comment_id])
);

-- =========================================
-- INDEXES
-- =========================================

CREATE INDEX [idx_projects_owner]
    ON [dbo].[projects] ([owner_id]);

CREATE INDEX [idx_projects_category]
    ON [dbo].[projects] ([category_id]);

CREATE INDEX [idx_projects_name]
    ON [dbo].[projects] ([project_name]);

CREATE INDEX [idx_projects_status]
    ON [dbo].[projects] ([status]);

CREATE INDEX [idx_project_files_project]
    ON [dbo].[project_files] ([project_id]);

CREATE INDEX [idx_project_files_uploader]
    ON [dbo].[project_files] ([uploaded_by]);

CREATE INDEX [idx_contribution_history_contribution]
    ON [dbo].[contribution_history] ([contribution_id]);

CREATE INDEX [idx_contribution_history_changed_by]
    ON [dbo].[contribution_history] ([changed_by]);

CREATE INDEX [idx_project_upvotes_project]
    ON [dbo].[project_upvotes] ([project_id]);

CREATE INDEX [idx_project_comments_project_created]
    ON [dbo].[project_comments] ([project_id], [created_at]);

CREATE INDEX [idx_project_comments_parent]
    ON [dbo].[project_comments] ([project_id], [parent_comment_id]);
  FOREIGN KEY ("user_id")
  REFERENCES "users" ("user_id")
  ON DELETE CASCADE
  DEFERR
