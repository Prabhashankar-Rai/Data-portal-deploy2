import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'data', 'user-management.json');

export function getDb() {
    if (!fs.existsSync(DB_FILE)) {
        fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
        fs.writeFileSync(DB_FILE, JSON.stringify({
            Users: [],
            Groups: [],
            User_Groups: [],
            Modules: [],
            User_Module_Access: [],
            Datasets: [],
            Actions: [],
            User_App_Actions: [],
            Access_Elements: [],
            User_Access_Filter: [],
            Chat_History: [],
            Token_Usage: [],
            User_Quotas: [],
            Audit_Log: []
        }, null, 2));
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

export function saveDb(data: any) {
    if (!fs.existsSync(path.dirname(DB_FILE))) {
        fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}
