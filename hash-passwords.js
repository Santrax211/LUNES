const mysql = require('mysql2');
const bcrypt = require('bcryptjs');

// Conexión a la base de datos MySQL
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'admin123',
    database: 'bloglunes'
});

db.connect((err) => {
    if (err) {
        console.error('Error conectando a MySQL:', err);
        return;
    }
    console.log('Conectado a la base de datos MySQL');

    // Obtener las contraseñas en texto plano (esto es solo para ejemplo, debes tener cuidado con esto)
    const query = 'SELECT id, password FROM users';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error obteniendo contraseñas:', err);
            return;
        }

        results.forEach(user => {
            // Hashear la contraseña
            bcrypt.hash(user.password, 10, (err, hash) => {
                if (err) {
                    console.error('Error hasheando la contraseña:', err);
                    return;
                }

                // Actualizar la base de datos con el hash
                const updateQuery = 'UPDATE users SET password = ? WHERE id = ?';
                db.query(updateQuery, [hash, user.id], (err) => {
                    if (err) {
                        console.error('Error actualizando la contraseña:', err);
                    } else {
                        console.log(`Contraseña del usuario con ID ${user.id} actualizada.`);
                    }
                });
            });
        });
    });
});
