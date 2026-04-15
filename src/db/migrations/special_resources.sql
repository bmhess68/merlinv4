-- Special Resources Categories Table
CREATE TABLE IF NOT EXISTS special_resource_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Special Resources Entries Table
CREATE TABLE IF NOT EXISTS special_resources (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL,
    category_id INTEGER REFERENCES special_resource_categories(id),
    skill_description TEXT,
    tour_start TIMESTAMP WITH TIME ZONE NOT NULL,
    tour_end TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index on active resources and category
CREATE INDEX IF NOT EXISTS idx_special_resources_active ON special_resources(is_active);
CREATE INDEX IF NOT EXISTS idx_special_resources_category ON special_resources(category_id);

-- Initial categories for the dropdown
INSERT INTO special_resource_categories (name, description)
VALUES 
    ('K-9', 'K-9 Unit'),
    ('Drone Operator', 'Qualified drone pilot'),
    ('SWAT', 'Special Weapons And Tactics'),
    ('Hostage Negotiator', 'Trained hostage negotiator'),
    ('EMT/Paramedic', 'Emergency Medical Technician/Paramedic'),
    ('Accident Investigation', 'Specialized in accident investigation'),
    ('Bilingual - Spanish', 'Spanish language fluency'),
    ('Bilingual - Other', 'Other language fluency'),
    ('Crisis Intervention', 'Mental health crisis intervention'),
    ('Digital Forensics', 'Computer/device forensic investigation'),
    ('Tactical Medic', 'Medical support in tactical situations'),
    ('Hazmat Specialist', 'Hazardous materials specialist'),
    ('Dive Team', 'Underwater search and recovery'),
    ('Marine Unit', 'Marine/water patrol unit'),
    ('Motor Unit', 'Motorcycle unit'),
    ('Other', 'Other specialization')
ON CONFLICT (name) DO NOTHING;

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for special_resources table
DROP TRIGGER IF EXISTS update_special_resources_timestamp ON special_resources;
CREATE TRIGGER update_special_resources_timestamp
BEFORE UPDATE ON special_resources
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Trigger for special_resource_categories table
DROP TRIGGER IF EXISTS update_special_resource_categories_timestamp ON special_resource_categories;
CREATE TRIGGER update_special_resource_categories_timestamp
BEFORE UPDATE ON special_resource_categories
FOR EACH ROW
EXECUTE FUNCTION update_modified_column(); 