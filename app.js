const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const flash = require('connect-flash');
const crypto = require('crypto');
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

// Rutas

// Ruta de inicio de sesión
app.get('/login', (req, res) => {
    res.render('login', { 
        user: req.user || null,  // Asegúrate de que `user` esté definido
        messages: { error: req.flash('error') }  // Mensajes de error
    });
});


/*app.post('/login', passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
}));*/

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

// Middleware para proteger rutas
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

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

app.post('/nuevo-post', isAuthenticated, (req, res) => {
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

app.post('/editar-post/:id', isAuthenticated, (req, res) => {
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
