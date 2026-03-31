import { NextResponse } from 'next/server';
import { getDb, saveDb } from '@/lib/json-db';

export async function GET() {
    try {
        const db = getDb();

        if (!db.Access_Elements || db.Access_Elements.length === 0) {
            db.Access_Elements = [
                { element_id: 1, element_name: 'Reporting Line', element_datatype: 'Character', generic_column_name: 'REPORTING_LINE' },
                { element_id: 2, element_name: 'Reporting Branch', element_datatype: 'Character', generic_column_name: 'REPORTING_BRANCH' },
                { element_id: 3, element_name: 'Source', element_datatype: 'Character', generic_column_name: 'SOURCE' },
                { element_id: 4, element_name: 'Line of Business', element_datatype: 'Character', generic_column_name: 'LOB' },
                { element_id: 5, element_name: 'UW Period', element_datatype: 'date', generic_column_name: 'UW_DATE' },
                { element_id: 6, element_name: 'AC Period', element_datatype: 'date', generic_column_name: 'AC_DATE' }
            ];
            saveDb(db);
        }

        return NextResponse.json({ data: db.Access_Elements });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { element_name, element_datatype, generic_column_name } = body;

        if (!element_name || !element_datatype || !generic_column_name) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const db = getDb();
        if (!db.Access_Elements) db.Access_Elements = [];

        const newId = Math.max(0, ...db.Access_Elements.map((e: any) => e.element_id)) + 1;

        const newElement = {
            element_id: newId,
            element_name,
            element_datatype,
            generic_column_name: generic_column_name.toUpperCase().replace(/\s+/g, '_')
        };

        db.Access_Elements.push(newElement);
        saveDb(db);

        return NextResponse.json({ message: 'Access element created successfully', data: newElement }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const { element_id, element_name, element_datatype, generic_column_name } = body;

        if (!element_id || !element_name || !element_datatype || !generic_column_name) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const db = getDb();
        if (!db.Access_Elements) return NextResponse.json({ error: 'No elements found' }, { status: 404 });

        const index = db.Access_Elements.findIndex((e: any) => e.element_id === element_id);
        if (index === -1) {
            return NextResponse.json({ error: 'Element not found' }, { status: 404 });
        }

        db.Access_Elements[index] = {
            ...db.Access_Elements[index],
            element_name,
            element_datatype,
            generic_column_name: generic_column_name.toUpperCase().replace(/\s+/g, '_')
        };
        saveDb(db);

        return NextResponse.json({ message: 'Access element updated successfully', data: db.Access_Elements[index] }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const body = await req.json();
        const { element_id } = body;

        if (!element_id) {
            return NextResponse.json({ error: 'Missing element_id' }, { status: 400 });
        }

        const db = getDb();
        if (!db.Access_Elements) return NextResponse.json({ error: 'No elements found' }, { status: 404 });

        const index = db.Access_Elements.findIndex((e: any) => e.element_id === element_id);
        if (index === -1) {
            return NextResponse.json({ error: 'Element not found' }, { status: 404 });
        }

        db.Access_Elements.splice(index, 1);
        saveDb(db);

        // Optional: Cascade delete filters that used this element (business logic dependent)
        if (db.User_Access_Filter) {
            db.User_Access_Filter = db.User_Access_Filter.filter((f: any) => f.element_id !== element_id);
            saveDb(db);
        }

        return NextResponse.json({ message: 'Access element deleted successfully' }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
