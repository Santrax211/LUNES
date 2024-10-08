const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const flash = require('connect-flash');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Asegúrate de importar fs
const app = express();

// Configuración del motor de plantillas EJS
app.set('view engine', 'ejs');
app.use(express.static('public')); // Archivos estáticos como CSS
app.use(bodyParser.urlencoded({ extended: true }));

// Configuración de la sesión
app.use(session({
    secret: crypto.randomBytes(64).toString('hex'), // Cambia esto por una clave secreta
    resave: false,
    saveUninitialized: false
}));

// Configuración de Passport
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

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
});

// Configuración de Passport para autenticación
passport.use(new LocalStrategy(
    (username, password, done) => {
        const query = 'SELECT * FROM users WHERE username = ?';
        db.query(query, [username], (err, results) => {
            if (err) return done(err);
            if (results.length === 0) return done(null, false, { message: 'Usuario no encontrado' });

            const user = results[0];
            bcrypt.compare(password, user.password, (err, res) => {
                if (err) return done(err);
                if (res) return done(null, user);
                else return done(null, false, { message: 'Contraseña incorrecta' });
            });
        });
    }
));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    const query = 'SELECT * FROM users WHERE id = ?';
    db.query(query, [id], (err, results) => {
        if (err) return done(err);
        done(null, results[0]);
    });
});

// Configuración de multer para guardar archivos en la carpeta 'public/uploads'
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads'); // Cambia esto si deseas una ruta diferente
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, Date.now() + ext); // Guarda el archivo con un nombre único
    }
});

const upload = multer({ storage });

// Middleware para proteger rutas
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

// Ruta de inicio de sesión
app.get('/login', (req, res) => {
    res.render('login', { 
        user: req.user || null,  // Asegúrate de que `user` esté definido
        messages: { error: req.flash('error') }  // Mensajes de error
    });
});

app.post('/login', (req, res, next) => {
    console.log(req.body); // Verifica si los datos están llegando correctamente
    passport.authenticate('local', {
        successRedirect: '/',
        failureRedirect: '/login',
        failureFlash: true
    })(req, res, next);
});

// Ruta para la página de registro
app.get('/register', (req, res) => {
    res.render('register');
});

// Ruta para manejar el registro de usuarios
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) return res.status(500).send('Error en el registro');
        const query = 'INSERT INTO users (username, password) VALUES (?, ?)';
        db.query(query, [username, hash], (err) => {
            if (err) return res.status(500).send('Error en el registro');
            res.redirect('/login');
        });
    });
});

// Ruta para mostrar los posts
app.get('/', (req, res) => {
    const query = 'SELECT * FROM posts ORDER BY fecha DESC';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error obteniendo posts:', err);
            res.sendStatus(500);
        } else {
            res.render('index', { posts: results, user: req.user });
        }
    });
});

// Ruta para crear un nuevo post (protegida)
app.get('/nuevo-post', isAuthenticated, (req, res) => {
    res.render('nuevo-post');
});

app.post('/nuevo-post', isAuthenticated, upload.single('imagen'), (req, res) => {
    const { titulo, contenido, autor } = req.body;
    const imagen = req.file ? req.file.filename : null; // Obtén el nombre del archivo cargado
    const query = 'INSERT INTO posts (titulo, contenido, autor, imagen) VALUES (?, ?, ?, ?)';
    db.query(query, [titulo, contenido, autor, imagen], (err) => {
        if (err) {
            console.error('Error insertando nuevo post:', err);
            res.sendStatus(500);
        } else {
            res.redirect('/');
        }
    });
});

// Ruta para editar un post (protegida)
app.get('/editar-post/:id', isAuthenticated, (req, res) => {
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

app.post('/editar-post/:id', isAuthenticated, upload.single('imagen'), (req, res) => {
    const postId = req.params.id;
    const { titulo, contenido, autor, removeImage } = req.body;
    let imagen = req.file ? req.file.filename : null; // Obtén el nombre del archivo cargado

    // Verificar si se debe eliminar la imagen actual
    if (removeImage === 'on') {
        imagen = null;
    }

    // Obtener la imagen actual del post si no se está eliminando
    const query = 'SELECT imagen FROM posts WHERE id = ?';
    db.query(query, [postId], (err, results) => {
        if (err) {
            console.error('Error obteniendo el post:', err);
            res.sendStatus(500);
            return;
        }
        const currentImage = results[0].imagen;

        // Actualizar el post
        const updateQuery = 'UPDATE posts SET titulo = ?, contenido = ?, autor = ?, imagen = ? WHERE id = ?';
        db.query(updateQuery, [titulo, contenido, autor, imagen || currentImage, postId], (err) => {
            if (err) {
                console.error('Error actualizando el post:', err);
                res.sendStatus(500);
                return;
            }

            // Eliminar la imagen antigua si es necesario
            if (imagen === null && currentImage) {
                fs.unlink(path.join('public/uploads', currentImage), (err) => {
                    if (err) console.error('Error eliminando la imagen:', err);
                });
            }

            res.redirect('/');
        });
    });
});

// Ruta para cerrar sesión
app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) { return next(err); }
        res.redirect('/');
    });
});

// Iniciar el servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});

