import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const pool = (await import('@/lib/db')).default;

        const res = await pool.query('SELECT * FROM Access_Elements ORDER BY element_id ASC');
        let elements = res.rows;

        // Auto-seed if empty
        if (elements.length === 0) {
            const seed = [
                ['Reporting Line', 'Character', 'REPORTING_LINE'],
                ['Reporting Branch', 'Character', 'REPORTING_BRANCH'],
                ['Source', 'Character', 'SOURCE'],
                ['Line of Business', 'Character', 'LOB'],
                ['UW Period', 'date', 'UW_DATE'],
                ['AC Period', 'date', 'AC_DATE']
            ];
            for (const [name, type, col] of seed) {
                await pool.query(
                    'INSERT INTO Access_Elements (element_name, element_datatype, generic_column_name) VALUES ($1, $2, $3)',
                    [name, type, col]
                );
            }
            const reRes = await pool.query('SELECT * FROM Access_Elements ORDER BY element_id ASC');
            elements = reRes.rows;
        }

        return NextResponse.json({ data: elements });
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

        const pool = (await import('@/lib/db')).default;
        
        const formattedCol = generic_column_name.toUpperCase().replace(/\s+/g, '_');

        const res = await pool.query(
            'INSERT INTO Access_Elements (element_name, element_datatype, generic_column_name) VALUES ($1, $2, $3) RETURNING *',
            [element_name, element_datatype, formattedCol]
        );

        return NextResponse.json({ message: 'Access element created successfully', data: res.rows[0] }, { status: 201 });
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

        const pool = (await import('@/lib/db')).default;
        const formattedCol = generic_column_name.toUpperCase().replace(/\s+/g, '_');

        const res = await pool.query(
            'UPDATE Access_Elements SET element_name = $1, element_datatype = $2, generic_column_name = $3 WHERE element_id = $4 RETURNING *',
            [element_name, element_datatype, formattedCol, element_id]
        );

        if (res.rowCount === 0) {
            return NextResponse.json({ error: 'Element not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Access element updated successfully', data: res.rows[0] }, { status: 200 });
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

        const pool = (await import('@/lib/db')).default;
        
        const res = await pool.query('DELETE FROM Access_Elements WHERE element_id = $1', [element_id]);

        if (res.rowCount === 0) {
            return NextResponse.json({ error: 'Element not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Access element deleted successfully' }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
