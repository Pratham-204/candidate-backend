CREATE DATABASE candidate_management;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    specialization VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    years_experience VARCHAR(50) NOT NULL,
    remark TEXT,
    resume_url VARCHAR(255) NOT NULL,
    employee_referral BOOLEAN DEFAULT FALSE,
    employee_id VARCHAR(255),
    consultancy_referral BOOLEAN DEFAULT FALSE,
    consultancy_name VARCHAR(255)
);
