const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const app = express();

// Configuración del motor de plantillas EJS
app.set('view engine', 'ejs');
app.use(express.static('public')); // Archivos estáticos como CSS
app.use(bodyParser.urlencoded({ extended: true }));

// Conexión a la base de datos MySQL
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root', // Cambia a tu usuario de MySQL
    password: 'admin123', // Cambia a tu contraseña
    database: 'bloglunes'
});

db.connect((err) => {
    if (err) {
        console.error('Error conectando a MySQL:', err);
        return;
    }
    console.log('Conectado a la base de datos MySQL');
});

// Ruta principal para mostrar los posts
app.get('/', (req, res) => {
    const query = 'SELECT * FROM posts ORDER BY fecha DESC';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error obteniendo posts:', err);
            res.sendStatus(500);
        } else {
            res.render('index', { posts: results });
        }
    });
});

// Ruta para crear un nuevo post
app.get('/nuevo-post', (req, res) => {
    res.render('nuevo-post');
});

// Ruta POST para guardar el nuevo post en la base de datos
app.post('/nuevo-post', (req, res) => {
    const { titulo, contenido, autor } = req.body;
    const query = 'INSERT INTO posts (titulo, contenido, autor) VALUES (?, ?, ?)';
    db.query(query, [titulo, contenido, autor], (err) => {
        if (err) {
            console.error('Error insertando nuevo post:', err);
            res.sendStatus(500);
        } else {
            res.redirect('/');
        }
    });
});

// Ruta para mostrar el formulario de edición con los datos del post existente
app.get('/editar-post/:id', (req, res) => {
    const postId = req.params.id;
    const query = 'SELECT * FROM posts WHERE id = ?';
    db.query(query, [postId], (err, results) => {
        if (err) {
            console.error('Error obteniendo el post:', err);
            res.sendStatus(500);
        } else if (results.length > 0) {
            res.render('editar-post', { post: results[0] });
        } else {
            res.status(404).send('Post no encontrado');
        }
    });
});

// Ruta POST para actualizar el post
app.post('/editar-post/:id', (req, res) => {
    const postId = req.params.id;
    const { titulo, contenido, autor } = req.body;
    const query = 'UPDATE posts SET titulo = ?, contenido = ?, autor = ? WHERE id = ?';
    db.query(query, [titulo, contenido, autor, postId], (err) => {
        if (err) {
            console.error('Error actualizando el post:', err);
            res.sendStatus(500);
        } else {
            res.redirect('/');
        }
    });
});

// Iniciar el servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});
