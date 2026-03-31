import pool from './db';

/**
 * Checks if a user has access to a specific module and action
 */
export async function checkModuleAccess(userId: string, moduleName: string, requiredAction: string): Promise<boolean> {
    const query = `
      SELECT 1 FROM User_Roles ur
      JOIN Role_Module_Access rma ON ur.role_id = rma.role_id
      JOIN Modules m ON rma.module_id = m.module_id
      JOIN Actions a ON rma.action_id = a.action_id
      WHERE ur.user_id = $1 
        AND m.module_name = $2 
        AND a.action_name = $3
  `;
    const result = await pool.query(query, [userId, moduleName, requiredAction]);
    return result.rowCount !== null && result.rowCount > 0;
}

/**
 * Checks if a user has access to a specific dataset and action
 */
export async function checkDatasetAccess(userId: string, datasetId: string, requiredAction: string): Promise<boolean> {
    const query = `
      SELECT 1 FROM User_Roles ur
      JOIN Role_Dataset_Access rda ON ur.role_id = rda.role_id
      JOIN Actions a ON rda.action_id = a.action_id
      WHERE ur.user_id = $1 
        AND rda.dataset_id = $2 
        AND a.action_name = $3
  `;
    const result = await pool.query(query, [userId, datasetId, requiredAction]);
    return result.rowCount !== null && result.rowCount > 0;
}

/**
 * Generates dynamic SQL conditions for reading a dataset based on User Access Filters
 * Returns empty condition '1=0' if no permissions.
 */
export async function getDatasetQueryConditions(userId: string, datasetId: string): Promise<{ conditionString: string; params: any[] }> {
    const filtersQuery = `
      SELECT af.column_name, af.operator, af.filter_value 
      FROM Access_Filters af
      JOIN User_Roles ur ON af.role_id = ur.role_id
      WHERE ur.user_id = $1 AND af.dataset_id = $2
  `;
    const result = await pool.query(filtersQuery, [userId, datasetId]);

    // If no filters exist for this user's roles, default strictly to NO ACCESS (or handle Admin roles globally)
    if (result.rowCount === 0) {
        return { conditionString: '1=0', params: [] };
    }

    let conditionString: string[] = [];
    let params: any[] = [];

    result.rows.forEach((filter, index) => {
        const paramIndex = index + 1;
        conditionString.push(`"${filter.column_name}" ${filter.operator} $${paramIndex}`);
        params.push(filter.filter_value);
    });

    return {
        conditionString: `(${conditionString.join(' OR ')})`,
        params
    };
}
