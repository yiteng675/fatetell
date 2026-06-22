CREATE DATABASE IF NOT EXISTS fatetell DEFAULT CHARSET utf8mb4;
USE fatetell;

CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  phone       VARCHAR(20) UNIQUE NOT NULL,
  nickname    VARCHAR(50),
  avatar_url  VARCHAR(255),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profiles (
  id          VARCHAR(36) PRIMARY KEY,
  user_id     INT NOT NULL,
  name        VARCHAR(50),
  gender      VARCHAR(10),
  relation    VARCHAR(20),
  year        INT,
  month       INT,
  day         INT,
  hour        INT,
  year_gz     VARCHAR(10),
  month_gz    VARCHAR(10),
  day_gz      VARCHAR(10),
  hour_gz     VARCHAR(10),
  day_gan     VARCHAR(5),
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sms_codes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  phone       VARCHAR(20) NOT NULL,
  code        VARCHAR(6)  NOT NULL,
  expires_at  TIMESTAMP   NOT NULL,
  used        TINYINT(1)  DEFAULT 0,
  created_at  TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_phone (phone)
);
