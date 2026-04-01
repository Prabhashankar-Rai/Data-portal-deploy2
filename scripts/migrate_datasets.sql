-- Migration script to update the Dataset table to support full metadata
-- This will ensure persistence of dataset registration on Vercel

ALTER TABLE Dataset 
ADD COLUMN IF NOT EXISTS file_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS file_path TEXT,
ADD COLUMN IF NOT EXISTS purpose TEXT,
ADD COLUMN IF NOT EXISTS created_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS columns_json JSONB;

-- Rename dataset_label to display_label if it's different in the code
-- We'll keep the existing names but add aliases or just use them as is.
