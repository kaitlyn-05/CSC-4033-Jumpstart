/* ============================================
                JUMPSTART DATABASE
   ============================================ */


/* ============================================
                USERS AND ACCOUNTS
   ============================================ */

CREATE TABLE users (
    /* PostgreSQL will automatically generate the number stored as 
        the primary key */
    user_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, 
    username VARCHAR(30) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(12) NOT NULL DEFAULT 'active',

    /* NEED TO ADD CONSTRAINT TO CHECK USER STATUS FOR ACTIVE OR DELETED */

);

/* ============================================
                USER PROFILES
============================================ */
/* if wanted, can tak out bio, and profile picture */
CREATE TABLE profiles (
    user_id INTEGER PRIMARY KEY,
    display_name VARCHAR(60) NOT NULL,
    bio VARCHAR(500),
    photo_url VARCHAR(500)

    FORGEIN KEY (user_i)
        REFERENCES users(user_id)
        ON DELETE CASCADE
        
);
