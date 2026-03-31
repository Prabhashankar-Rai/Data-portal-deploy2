-- 1. User
CREATE TABLE Users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_name VARCHAR(100) NOT NULL,
    user_email VARCHAR(255) UNIQUE NOT NULL,
    user_designation VARCHAR(100)
);

-- 2. Group
CREATE TABLE Groups (
    group_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_name VARCHAR(100) UNIQUE NOT NULL,
    group_purpose TEXT,
    group_email_id VARCHAR(255)
);

-- 3. User Group
CREATE TABLE User_Group (
    group_id UUID REFERENCES Groups(group_id) ON DELETE CASCADE,
    user_id UUID REFERENCES Users(user_id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, user_id)
);

-- 4. Module
CREATE TABLE Module (
    module_id VARCHAR(50) PRIMARY KEY, -- 'DATA_CHAT', 'TABLEAU', 'DOWNLOAD'
    module_name VARCHAR(100) UNIQUE NOT NULL,
    module_purpose TEXT
);

-- 5. User Module
CREATE TABLE User_Module (
    group_id UUID REFERENCES Groups(group_id) ON DELETE CASCADE,
    module_id VARCHAR(50) REFERENCES Module(module_id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, module_id)
);

-- 6. Access Elements
CREATE TABLE Access_Elements (
    element_id SERIAL PRIMARY KEY,
    element_name VARCHAR(100) NOT NULL,
    element_datatype VARCHAR(50) NOT NULL,
    generic_column_name VARCHAR(100) NOT NULL
);

-- 7. User Access Filter
CREATE TABLE User_Access_Filter (
    filter_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES Groups(group_id) ON DELETE CASCADE,
    element_id INTEGER REFERENCES Access_Elements(element_id) ON DELETE CASCADE,
    operator VARCHAR(20) NOT NULL, -- '=', '>=', '<=', '<>', 'IN', 'LIKE', 'NOT IN'
    element_value VARCHAR(255) NOT NULL
);

-- 8. Dataset
CREATE TABLE Dataset (
    dataset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_name VARCHAR(255) NOT NULL,
    dataset_label VARCHAR(255) NOT NULL,
    dataset_type VARCHAR(50)
);

-- 9. Action
CREATE TABLE Actions (
    action_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_name VARCHAR(50) UNIQUE NOT NULL -- 'View', 'Download', 'Create'
);

-- 10. User App Action (Dataset Access permissions)
CREATE TABLE User_App_Actions (
    app_action_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES Users(user_id) ON DELETE CASCADE,
    group_id UUID REFERENCES Groups(group_id) ON DELETE CASCADE,
    dataset_id UUID REFERENCES Dataset(dataset_id) ON DELETE CASCADE,
    action_id UUID REFERENCES Actions(action_id) ON DELETE CASCADE,
    CHECK (user_id IS NOT NULL OR group_id IS NOT NULL)
);
