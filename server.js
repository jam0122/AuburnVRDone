const sqlite3 = require("sqlite3").verbose()
const bodyParser = require("body-parser")
const formidable = require("formidable")
const fs = require("fs")
const url = require("url")
const unzipper = require("unzipper")
const http = require("http")
const express = require("express")

var app = express()
var server = http.createServer(app)
app.use(bodyParser.urlencoded({extended: false}))
app.set("view engine", "ejs")

const io = require("socket.io")(server)

//IO events
var sessions = {}

io.on("connection", function (socket) {
    socket.on("teacherSessionUpdate", function(data) {
        sessions[data.session] = {
            pos:data.pos,
            rot:data.rot
        }
    })
    function updateStudentSessions() {
        io.sockets.emit("studentSessionUpdate", sessions)
    }
    setInterval(updateStudentSessions, 5)
})

//used to serve static files
//app.use("/uploads", express.static(__dirname + "/uploads"))
app.use(express.static("public"))

app.use(express.static("uploads"))

app.get("/", function(req, res) {
    res.render("pages/index")
})

app.get("/about", function(req, res) {
    res.render("pages/about")
})

app.get("/professor-login", function(req, res) {
    res.render("pages/professor-login")
})

app.get("/new-professor", function(req, res) {
    res.render("pages/new-professor")
})

app.get("/student-login", function(req, res) {
    res.render("pages/student-login")
})

app.get("/new-student", function(req, res) {
    res.render("pages/new-student")
})

app.get("/professor-view", function(req, res) {
    getBody = {
        auburn_id:req.query.auburn_id,
        password:req.query.password,
        user_type:"professor"
    }
    var db = new sqlite3.Database(__dirname + "/databases/UserDB.db", sqlite3.OPEN_READWRITE, (err) => {
        if (err) {
            return console.error(err.message)
        }
        console.log("connected to sqlite3 database")
    })

    let values = [getBody.auburn_id, getBody.password, getBody.user_type]
    let sql = "SELECT * FROM users WHERE auburn_id = ? AND password = ? AND user_type = ?"

    db.all(sql, values, function(err, rows) {
        if (err) {
            console.log(err.message)
            //send to error page here
        } else {
            if(rows.length < 1) {
                console.log("professor does not exist")
                res.render("pages/professor-does-not-exist")
            } else {
                console.log("professor exists")

                sql = "SELECT name FROM categories WHERE auburn_id = ?"
                values = [req.query.auburn_id]

                categories = []

                db.all(sql, values, function(err, rows){
                    if (err) {
                        console.log(err.message)
                        //send to error page here
                    } else {
                        if (rows.length < 1) {
                            categories.push("no categories yet")
                        } else {
                            categories = rows
                        }
                        sql = "SELECT * FROM files WHERE auburn_id = ?"
                        values = [req.query.auburn_id]

                        files = []

                        db.all(sql, values, function(err, rows){
                            if (err) {
                                console.log(err.message)
                                    //send to error page here
                            } else {
                                files = rows

                                res.render("pages/professor-view", {
                                    auburn_id:req.query.auburn_id,
                                    files:files,
                                    categories:categories
                                })
                            }
                        })
                    }
                })
            }
        }
    })
    db.close((err) => {
        if (err) {
            console.log(err.message)
        } else {
            console.log("database connection closed")
        }
    })
})


app.get("/student-view", function(req, res) {
    getBody = {
        auburn_id:req.query.auburn_id,
        password:req.query.password,
        user_type:"student"
    }
    var db = new sqlite3.Database(__dirname + "/databases/UserDB.db", sqlite3.OPEN_READWRITE, (err) => {
        if (err) {
            return console.error(err.message)
        }
        console.log("connected to sqlite3 database")
    })

    let values = [getBody.auburn_id, getBody.password, getBody.user_type]
    let sql = "SELECT * FROM users WHERE auburn_id = ? AND password = ? AND user_type = ?"

    db.all(sql, values, function(err, rows) {
        if (err) {
            console.log(err.message)
            //send to error page here
        } else {
            if(rows.length < 1) {
                console.log("student does not exist")
                res.render("pages/student-does-not-exist")
            } else {
                sql = "SELECT name FROM files WHERE auburn_id = ?"
                values = getBody.auburn_id

                db.all(sql, values, function(err, rows){
                    res.render("pages/student-view", {
                        auburn_id:getBody.auburn_id,
                        files:rows,
                    })
                })
            }
        }
    })
    db.close((err) => {
        if (err) {
            console.log(err.message)
        } else {
            console.log("database connection closed")
        }
    })
})

app.get("/student-file-view", function(req, res) {
    var db = new sqlite3.Database(__dirname + "/databases/UserDB.db", sqlite3.OPEN_READWRITE, (err) => {
        if (err) {
            return console.error(err.message)
        }
        console.log("connected to sqlite3 database")
    })

    let values = req.query.session
    let sql = "SELECT file_path FROM sessions WHERE auburn_id = ?"

    db.all(sql, values, function(err, rows) {
        if (err) {
            console.log(err.message)
            //send to error page here
        } else {
            if (rows.length < 1 ) {
                console.log("session does not exist")
            } else {
                console.log("session exists")
                res.render("pages/student-file-view", {
                    session:req.query.session,
                    file_name:rows[0].file_path
                })
            }
        }
    })
    db.close((err) => {
        if (err) {
            console.log(err.message)
        } else {
            console.log("database connection closed")
        }
    })
})

app.get("/professor-file-view", function(req, res) {
    var getBody = {
        auburn_id:req.query.auburn_id,
        category:req.query.category,
        name:req.query.file_name
    }

    var file_dir = __dirname + "/uploads/"
    var local_file_name = getBody.auburn_id + "-" + getBody.category + "-" + getBody.name
    var file_path = file_dir + local_file_name

    var db = new sqlite3.Database(__dirname + "/databases/UserDB.db", sqlite3.OPEN_READWRITE, (err) => {
        if (err) {
            return console.error(err.message)
        }
        console.log("connected to sqlite3 database")
    })

    var values = getBody.auburn_id
    var sql = 'SELECT * FROM sessions WHERE auburn_id = ?'
    db.all(sql, values, (err, rows) => {
        if (err) {
            console.log(err.message)
        } else {
            if (rows.length < 1) {
                var values = [local_file_name, getBody.auburn_id]
                var sql = "INSERT INTO sessions (file_path, auburn_id) VALUES (?, ?)"
                db.run(sql, values, (err) => {
                    if (err) {
                        console.log(err)
                    } else {
                        res.render("pages/professor-file-view", {
                            auburn_id:getBody.auburn_id,
                            //file_path:file_path,
                            file_name:local_file_name
                        })
                    }
                })
            } else {
                var values = [local_file_name, getBody.auburn_id]
                var sql = 'UPDATE sessions SET file_path = ? WHERE auburn_id = ?'
                db.run(sql, values, (err) => {
                    if (err) {
                        console.log(err.message)
                    } else {
                        res.render("pages/professor-file-view", {
                            auburn_id:getBody.auburn_id,
                            //file_path:file_path,
                            file_name:local_file_name
                        })
                    }
                })
            }
            
        }
    })
    db.close((err) => {
        if (err) {
            console.log(err.message)
        } else {
            console.log("database connection closed")
        }
    })
})

app.post("/professor-view", function(req, res) {
    var db = new sqlite3.Database(__dirname + "/databases/UserDB.db", sqlite3.OPEN_READWRITE, (err) => {
        if (err) {
            return console.error(err.message)
        }
        console.log("connected to sqlite3 database")
    })
    const postBody = req.body

    const values = [postBody.auburn_id, postBody.password, "professor"]
    const sql = 'INSERT INTO users(auburn_id, password, user_type) VALUES(?, ?, ?)'

    db.run(sql, values, (err) => {
        if (err) {
            console.log(err.message)
        } else {
            console.log("updated users table with professor")
            blankFile = {
                name: "no files yet"
            }
            res.render("pages/professor-view", {
                auburn_id:postBody.auburn_id,
                files:[blankFile],
                categories:["no categories yet"]
            })
        }
    })

    db.close((err) => {
        if (err) {
            console.log(err.message)
        } else {
            console.log("database connection closed")
        }
    })
})

app.post("/student-view", function(req, res) {
    var db = new sqlite3.Database(__dirname + "/databases/UserDB.db", sqlite3.OPEN_READWRITE, (err) => {
        if (err) {
            return console.error(err.message)
        }
        console.log("connected to sqlite3 database")
    })
    const postBody = req.body

    const values = [postBody.auburn_id, postBody.password, "student"]
    const sql = 'INSERT INTO users(auburn_id, password, user_type) VALUES(?, ?, ?)'

    db.run(sql, values, (err) => {
        if (err) {
            console.log(err.message)
        } else {
            console.log("updated users table with student")
            res.render("pages/student-view", {
                auburn_id:postBody.auburn_id,
                files:[]
            })
        }
    })

    db.close((err) => {
        if (err) {
            console.log(err.message)
        } else {
            console.log("database connection closed")
        }
    })
})

//probably could do this with ajax but this way is easier
app.post("/new-category-created", (req, res) => {
    console.log("post request to /new-category-created")
    var db = new sqlite3.Database(__dirname + "/databases/UserDB.db", sqlite3.OPEN_READWRITE, (err) => {
        if (err) {
            return console.error(err.message)
        }
        console.log("connected to sqlite3 database")
    })
    const postBody = req.body
    let values = [postBody.auburn_id, postBody.new_category]
    let sql = 'INSERT INTO categories(auburn_id, name) VALUES(?, ?)'
    db.run(sql, values, (err) => {
        if (err) {
            console.log(err.message)
        } else {
            sql = "SELECT name FROM categories WHERE auburn_id = ?"
            values = [postBody.auburn_id]

            categories = []

            db.all(sql, values, function(err, rows){
                if (err) {
                    console.log(err.message)
                    //send to error page here
                } else {
                    if (rows.length < 1) {
                        categories.push("no categories yet")
                    } else {
                        categories = rows
                    }
                    sql = "SELECT * FROM files WHERE auburn_id = ?"
                    values = [postBody.auburn_id]

                    files = []

                    db.all(sql, values, function(err, rows){
                        if (err) {
                            console.log(err.message)
                                //send to error page here
                        } else {
                            files = rows

                            res.render("pages/professor-view", {
                                auburn_id:postBody.auburn_id,
                                files:files,
                                categories:categories
                            })
                        }
                    })
                }
            })
        }
    })
    db.close((err) => {
        if (err) {
            console.log(err.message)
        } else {
            console.log("database connection closed")
        }
    })
})

app.post("/new-file-created", (req, res) => {
    console.log("post request to /new-file-created")
    var form = new formidable.IncomingForm()
    var file_dir = __dirname + "/uploads/"

    form.parse(req, function(err, fields, files) {
        if(err) {
            console.log(err.message)
        } else {
            var postBody = fields
            var file = files.upload
            var fileName = file.name
            var oldpath = file.path
            var newpath = file_dir + postBody.auburn_id + "-" + postBody.category + "-" + fileName
            //fs.createReadStream(oldpath).pipe(unzipper.Extract({ path: newpath }));
            fs.rename(oldpath, newpath, function(err) {
                if (err) {
                    throw err
                } else {
                    var db = new sqlite3.Database(__dirname + "/databases/UserDB.db", sqlite3.OPEN_READWRITE, (err) => {
                        if (err) {
                            return console.error(err.message)
                        }
                        console.log("connected to sqlite3 database")
                    })
                    
                    filePath = newpath + "/" + fileName
                    var values = [fileName, postBody.auburn_id, postBody.category, filePath]
                    var sql = 'INSERT INTO files(name, auburn_id, category, dir) VALUES(?, ?, ?, ?)'
                    
                    db.run(sql, values, function(err) {
                        if (err) {
                            console.log(err.message)
                        }
                        else {
                            sql = "SELECT name FROM categories WHERE auburn_id = ?"
                            values = [postBody.auburn_id]
            
                            categories = []
            
                            db.all(sql, values, function(err, rows){
                                if (err) {
                                    console.log(err.message)
                                //send to error page here
                                } else {
                                    if (rows.length < 1) {
                                        categories.push("no categories yet")
                                    } else {
                                        categories = rows
                                    }
                                    sql = "SELECT * FROM files WHERE auburn_id = ?"
                                    values = [postBody.auburn_id]
            
                                    files = []
            
                                    db.all(sql, values, function(err, rows){
                                        if (err) {
                                            console.log(err.message)
                                            //send to error page here
                                        } else {
                                            files = rows
            
                                            res.render("pages/professor-view", {
                                                auburn_id:postBody.auburn_id,
                                                files:files,
                                                categories:categories
                                            })
                                        }
                                    })
                                }
                            })
                        }
                    })
                    db.close((err) => {
                        if (err) {
                            console.log(err.message)
                        } else {
                            console.log("database connection closed")
                        }
                    })
                }
            })

            
        }
    })
})

app.post("/new-file-created-student", (req, res) => {
    console.log("post request to /new-file-created-student")
    var form = new formidable.IncomingForm()
    var file_dir = __dirname + "/uploads/"

    form.parse(req, function(err, fields, files) {
        if(err) {
            console.log(err.message)
        } else {
            var postBody = fields
            var file = files.upload
            var fileName = file.name
            var oldpath = file.path
            var newpath = file_dir + postBody.auburn_id + "-" + "student" + "-" + fileName
            //fs.createReadStream(oldpath).pipe(unzipper.Extract({ path: newpath }));
            fs.rename(oldpath, newpath, function(err) {
                if (err) {
                    throw err
                } else {
                    var db = new sqlite3.Database(__dirname + "/databases/UserDB.db", sqlite3.OPEN_READWRITE, (err) => {
                        if (err) {
                            return console.error(err.message)
                        }
                        console.log("connected to sqlite3 database")
                    })
                    
                    filePath = newpath
                    var values = [fileName, postBody.auburn_id, "student", filePath]
                    var sql = 'INSERT INTO files(name, auburn_id, category, dir) VALUES(?, ?, ?, ?)'
                    
                    db.run(sql, values, function(err) {
                        if (err) {
                            console.log(err.message)
                        }
                        else {
                            sql = "SELECT name FROM files WHERE auburn_id = ?"
                            values = postBody.auburn_id

                            db.all(sql, values, function(err, rows){
                                res.render("pages/student-view", {
                                    auburn_id:postBody.auburn_id,
                                    files:rows,
                                })
                            })
                        }
                    })
                    db.close((err) => {
                        if (err) {
                            console.log(err.message)
                        } else {
                            console.log("database connection closed")
                        }
                    })
                }
            })

            
        }
    })
})

//only deletes from database not file system
app.post("/delete-file-student-view", (req, res) => {
    var db = new sqlite3.Database(__dirname + "/databases/UserDB.db", sqlite3.OPEN_READWRITE, (err) => {
        if (err) {
            return console.error(err.message)
        }
        console.log("connected to sqlite3 database")
    })
    const postBody = req.body

    let values = [postBody.file_name]
    let sql = 'DELETE FROM files WHERE name = ?'

    db.run(sql, values, (err) => {
        if (err) {
            console.log(err.message)
        } else {
            sql = "SELECT name FROM files WHERE auburn_id = ?"
            values = postBody.auburn_id

            db.all(sql, values, function(err, rows){
                res.render("pages/student-view", {
                    auburn_id:postBody.auburn_id,
                    files:rows,
                })
            })
        }
    })

    db.close((err) => {
        if (err) {
            console.log(err.message)
        } else {
            console.log("database connection closed")
        }
    })
})

app.post("/delete-file-professor-view", (req, res) => {
    var db = new sqlite3.Database(__dirname + "/databases/UserDB.db", sqlite3.OPEN_READWRITE, (err) => {
        if (err) {
            return console.error(err.message)
        }
        console.log("connected to sqlite3 database")
    })
    const postBody = req.body

    let values = [postBody.file_name, postBody.auburn_id, postBody.category]
    let sql = 'DELETE FROM files WHERE name = ? AND auburn_id = ? AND category = ?'

    db.run(sql, values, (err) => {
        if (err) {
            console.log(err.message)
        } else {
            sql = "SELECT name FROM categories WHERE auburn_id = ?"
            values = [postBody.auburn_id]

            categories = []

            db.all(sql, values, function(err, rows){
                if (err) {
                    console.log(err.message)
                    //send to error page here
                } else {
                    if (rows.length < 1) {
                        categories.push("no categories yet")
                    } else {
                        categories = rows
                    }
                    sql = "SELECT * FROM files WHERE auburn_id = ?"
                    values = [postBody.auburn_id]

                    files = []

                    db.all(sql, values, function(err, rows){
                        if (err) {
                            console.log(err.message)
                                //send to error page here
                        } else {
                            files = rows

                            res.render("pages/professor-view", {
                                auburn_id:postBody.auburn_id,
                                files:files,
                                categories:categories
                            })
                        }
                    })
                }
            })
        }
    })

    db.close((err) => {
        if (err) {
            console.log(err.message)
        } else {
            console.log("database connection closed")
        }
    })
})

app.get("/student-file-view-solo", (req, res) => {
    var db = new sqlite3.Database(__dirname + "/databases/UserDB.db", sqlite3.OPEN_READWRITE, (err) => {
        if (err) {
            return console.error(err.message)
        }
        console.log("connected to sqlite3 database")
    })

    let values = req.query.file_name
    let sql = "SELECT * FROM files WHERE name = ?"

    db.all(sql, values, function(err, rows) {
        if (err) {
            console.log(err.message)
            //send to error page here
        } else {
            if (rows.length < 1 ) {
                console.log("file does not exist")
            } else {
                console.log("file exists")
                local_file_name = req.query.auburn_id + "-" + "student" + "-" + rows[0].name
                res.render("pages/student-file-view-solo", {
                    file_dir:local_file_name
                })
            }
        }
    })
    db.close((err) => {
        if (err) {
            console.log(err.message)
        } else {
            console.log("database connection closed")
        }
    })
})

app.post("/delete-category", (req, res) => {
    var db = new sqlite3.Database(__dirname + "/databases/UserDB.db", sqlite3.OPEN_READWRITE, (err) => {
        if (err) {
            return console.error(err.message)
        }
        console.log("connected to sqlite3 database")
    })
    const postBody = req.body

    let values = [postBody.category, postBody.auburn_id]
    let sql = 'SELECT * FROM files WHERE category = ? AND auburn_id = ?'

    db.all(sql, values, function(err, rows){
        if (err) {
            console.log(err.message)
        } else {
            if (rows.length < 1) {
                values = [postBody.category, postBody.auburn_id]
                sql = 'DELETE FROM categories WHERE name = ? AND auburn_id = ?'
                db.run(sql, values, (err) => {
                    if (err) {
                        console.log(err.message)
                    } else {
                        sql = "SELECT name FROM categories WHERE auburn_id = ?"
                        values = [postBody.auburn_id]
            
                        categories = []
            
                        db.all(sql, values, function(err, rows){
                            if (err) {
                                console.log(err.message)
                                //send to error page here
                            } else {
                                if (rows.length < 1) {
                                    categories.push("no categories yet")
                                } else {
                                    categories = rows
                                }
                                sql = "SELECT * FROM files WHERE auburn_id = ?"
                                values = [postBody.auburn_id]
            
                                files = []
            
                                db.all(sql, values, function(err, rows){
                                    if (err) {
                                        console.log(err.message)
                                            //send to error page here
                                    } else {
                                        files = rows
            
                                        res.render("pages/professor-view", {
                                            auburn_id:postBody.auburn_id,
                                            files:files,
                                            categories:categories
                                        })
                                    }
                                })
                            }
                        })
                    }
                })
            } else {
                values = [postBody.category, postBody.auburn_id]
                sql = 'DELETE FROM categories WHERE name = ? AND auburn_id = ?'
                db.run(sql, values, (err) => {
                    if (err) {
                        console.log(err.message)
                    } else {
                        values = [postBody.category, postBody.auburn_id]
                        sql = 'DELETE FROM files WHERE category = ? AND auburn_id = ?'
                        db.run(sql, values, (err) => {
                            if (err) {
                                console.log(err.message)
                            } else {
                                sql = "SELECT name FROM categories WHERE auburn_id = ?"
                                values = [postBody.auburn_id]
                            
                                categories = []
                            
                                db.all(sql, values, function(err, rows){
                                    if (err) {
                                        console.log(err.message)
                                        //send to error page here
                                    } else {
                                        if (rows.length < 1) {
                                            categories.push("no categories yet")
                                        } else {
                                            categories = rows
                                        }
                                        sql = "SELECT * FROM files WHERE auburn_id = ?"
                                        values = [postBody.auburn_id]
                            
                                        files = []
                            
                                        db.all(sql, values, function(err, rows){
                                            if (err) {
                                                console.log(err.message)
                                                    //send to error page here
                                            } else {
                                                files = rows
                            
                                                res.render("pages/professor-view", {
                                                    auburn_id:postBody.auburn_id,
                                                    files:files,
                                                    categories:categories
                                                })
                                            }
                                        })
                                    }
                                })
                            }
                        })
                    }
                })
            }
        }
    })
    db.close((err) => {
        if (err) {
            console.log(err.message)
        } else {
            console.log("database connection closed")
        }
    })
})

server.listen(5000, function() {
    console.info("listening on port 5000")
})