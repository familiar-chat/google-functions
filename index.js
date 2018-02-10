"use strict";

// input baseUrl
const baseUrl = "https://storage.googleapis.com/familiar-chat";

const functions = require("firebase-functions");
const admin     = require("firebase-admin");
const app       = require("express")();
const cors      = require("cors")(
    {
        origin        : "*",
        methods       : ["GET", "POST", "DELETE"],
        credentials   : true,
        allowedHeaders: ["Content-Type",
            "Authorization",
            "authorization",
            "Content-Length",
            "X-Requested-With"],
        maxAge        : 3600,
    }
);
const multer    = require("multer");
const upload    = multer({dest: "/tmp/"});

const gcs = require("@google-cloud/storage")();

admin.initializeApp(functions.config().firebase);

app.use(cors);

exports.countConnection = functions
    .database
    .ref("/organizations/{organizationId}/visitors/{visitorId}/general/connections")
    .onWrite(event => {
        let visitorRef  = admin.database().ref("/organizations/" + event.params.organizationId + "/visitors/" + event.params.visitorId);

        return visitorRef.transaction(d => {
            if (d)
                d.connected_count = Object.keys(d.general.connections || {}).map(key => d.general.connections[key]).filter(x => x.connected).length
            return d;
        }).then(
            () => undefined,
            () => console.error("NG")
        );
    });



let getDecodedIdToken = req => {
    if (!req.headers.authorization || !req.headers.authorization.startsWith("Bearer ")) 
        throw "UnAuthorization"

    return admin.auth()
        .verifyIdToken(req.headers.authorization.split("Bearer ")[1])
};


///////////////////////////////////////////////////////
// Site Image Endpoint
///////////////////////////////////////////////////////
app.post(
    "/organizations/:organizationId/sites/:siteId/image",
    upload.single("image_file"),
    (req, res) => {
        try {
            getDecodedIdToken(req)
                .then(decodedIdToken => {
                    admin.database()
                        .ref("/users/" + decodedIdToken.uid + "/organizations/" + req.params.organizationId)
                        .once("value")
                        .then(organizationSnapshot => {
                            let organization = organizationSnapshot.val()

                            if(organization == null || organization.user_id == null)
                                return res.status(403).json({message: "forbidden"})
                            
                            admin.database()
                                .ref("/organizations/" + req.params.organizationId + "/users/" + organization.user_id)
                                .once("value")
                                .then(userSnapshot => {
                                    let user = userSnapshot.val()

                                    if(user == null)
                                        return res.status(403).json({message: "forbidden"})
                                    
                                    // if(user.roles == "master")
                                    //     return res.status(401)

                                    if(!req.file.mimetype || req.file.mimetype.indexOf("image/") != 0)
                                        return res.status(400).json({message: "content type is not support"})
                                    
                                    let destination = "organizations/" + req.params.organizationId + "/sites/" + req.params.siteId + "/" + "widget"
                                    gcs.bucket("familiar-chat")
                                        .upload(
                                            req.file.path,
                                            {
                                                destination,
                                                public: true,
                                                metadata: {
                                                    contentType: req.file.mimetype
                                                }
                                            }
                                        ).then(_ => 
                                            res.status(201).json({file_path: baseUrl + "/" + destination + "?date=" + new Date().getTime()})
                                        )
                                })
                        })
                })
        } catch (e) {
            return res.status(401).json({message: "Unauthorized"})
        }
    }
)


///////////////////////////////////////////////////////
// User Image Endpoint
///////////////////////////////////////////////////////
app.post(
    "/organizations/:organizationId/users/:userId/image",
    upload.single("image_file"),
    (req, res) => {
        try {
            getDecodedIdToken(req)
                .then(decodedIdToken => {
                    admin.database()
                        .ref("/users/" + decodedIdToken.uid + "/organizations/" + req.params.organizationId)
                        .once("value")
                        .then(organizationSnapshot => {
                            let organization = organizationSnapshot.val()

                            if(organization == null || organization.user_id == null)
                                return res.status(403).json({message: "forbidden"})

                            if(req.params.userId != organization.user_id)
                                return res.status(403).json({message: "forbidden"})

                            admin.database()
                                .ref("/organizations/" + req.params.organizationId + "/users/" + organization.user_id)
                                .once("value")
                                .then(userSnapshot => {
                                    let user = userSnapshot.val()

                                    if(!user)
                                        return res.status(403).json({message: "forbidden"})
                                    
                                    // if(user.roles == "master")
                                    //     res.status(403).json({message: "forbidden"})

                                    if(!req.file.mimetype || req.file.mimetype.indexOf("image/") != 0)
                                        return res.status(400).json({message: "content type is not support"})

                                    let destination = "organizations/" + req.params.organizationId + "/users/" + req.params.userId + "/" + "avatar"
                                    gcs.bucket("familiar-chat")
                                        .upload(
                                            req.file.path,
                                            {
                                                destination,
                                                public: true,
                                                metadata: {
                                                    contentType: req.file.mimetype
                                                }
                                            }
                                        ).then(_ => 
                                            res.status(201).json({file_path: baseUrl + "/" + destination + "?date=" + new Date().getTime()})
                                        )
                                })
                        })
                })
        } catch (e) {
            return res.status(401).json({message: "Unauthorized"})
        }
    }
)

///////////////////////////////////////////////////////
// Visitor Message Image Endpoint
///////////////////////////////////////////////////////
app.post(
    "/organizations/:organizationId/visitors/:visitorId/messages/image",
    upload.single("image_file"),
    (req, res) => {
        try {
            getDecodedIdToken(req)
                .then(decodedIdToken => {
                    admin.database()
                        .ref("/visitors/" + decodedIdToken.uid + "/organizations/" + req.params.organizationId)
                        .once("value")
                        .then(organizationSnapshot => {
                            let organization = organizationSnapshot.val()

                            if(organization == null || organization.visitor_id == null)
                                return res.status(403).json({message: "forbidden"})
                            
                            if(req.params.visitorId != organization.visitor_id)
                                return res.status(403).json({message: "forbidden"})
                            
                            admin.database()
                                .ref("/organizations/" + req.params.organizationId + "/visitors/" + organization.visitor_id)
                                .once("value")
                                .then(visitorSnapshot => {
                                    let visitor = visitorSnapshot.val()

                                    if(visitor == null)
                                        return res.status(403).json({message: "forbidden"})
                                    
                                    if(!req.file.mimetype || req.file.mimetype.indexOf("image/") != 0)
                                        return res.status(400).json({message: "content type is not support"})
                                    
                                    let destination = "organizations/" + req.params.organizationId + "/visitors/" + req.params.visitorId + "/" + Math.random().toString(36).slice(-8)
                                    gcs.bucket("familiar-chat")
                                        .upload(
                                            req.file.path,
                                            {
                                                destination,
                                                public: true,
                                                metadata: {
                                                    contentType: req.file.mimetype
                                                }
                                            }
                                        ).then(_ => 
                                            res.status(201).json({file_path: baseUrl + "/" + destination + "?date=" + new Date().getTime()})
                                        )
                                })
                        })
                })
        } catch (e) {
            return res.status(401).json({message: "Unauthorized"})
        }
    }
)

app.delete(
    "/organizations/:organizationId/visitors/:visitorId/messages/image/:imageFileName",
    (req, res) => {
        try {
            getDecodedIdToken(req)
                .then(decodedIdToken => {
                    admin.database()
                        .ref("/visitors/" + decodedIdToken.uid + "/organizations/" + req.params.organizationId)
                        .once("value")
                        .then(organizationSnapshot => {
                            let organization = organizationSnapshot.val()

                            if(organization == null || organization.visitor_id == null)
                                return res.status(403).json({message: "forbidden"})
                            
                            if(req.params.visitorId != organization.visitor_id)
                                return res.status(403).json({message: "forbidden"})
                            
                            admin.database()
                                .ref("/organizations/" + req.params.organizationId + "/visitors/" + organization.visitor_id)
                                .once("value")
                                .then(visitorSnapshot => {
                                    let visitor = visitorSnapshot.val()

                                    if(visitor == null)
                                        return res.status(403).json({message: "forbidden"})
                                    
                                    let destination = "organizations/" + req.params.organizationId + "/visitors/" + req.params.imageFileName
                                    gcs.bucket("familiar-chat")
                                        .file(destination)
                                        .delete()
                                        .then(_ =>
                                            res.status(204).json({file_path: baseUrl + "/" + destination})
                                        )
                                })
                        })
                })
        } catch (e) {
            return res.status(401).json({message: "Unauthorized"})
        }
    }
)


///////////////////////////////////////////////////////
// Visitor ReceivedMessages Image Endpoint
///////////////////////////////////////////////////////

app.post(
    "/organizations/:organizationId/visitors/:visitorId/received_messages/image",
    upload.single("image_file"),
    (req, res) => {
        try {
            getDecodedIdToken(req)
                .then(decodedIdToken => {
                    admin.database()
                        .ref("/users/" + decodedIdToken.uid + "/organizations/" + req.params.organizationId)
                        .once("value")
                        .then(organizationSnapshot => {
                            let organization = organizationSnapshot.val()

                            if(organization == null || organization.user_id == null)
                                return res.status(403).json({message: "forbidden"})
                            
                            admin.database()
                                .ref("/organizations/" + req.params.organizationId + "/users/" + organization.user_id)
                                .once("value")
                                .then(userSnapshot => {
                                    let user = userSnapshot.val()

                                    if(user == null)
                                        return res.status(403).json({message: "forbidden"})
                                    
                                    // if(user.roles == "master")
                                    //     return res.status(401)

                                    if(!req.file.mimetype || req.file.mimetype.indexOf("image/") != 0)
                                        return res.status(400).json({message: "content type is not support"})
                                    
                                    let destination = "organizations/" + req.params.organizationId + "/visitors/" + req.params.visitorId + "/" + Math.random().toString(36).slice(-8)
                                    gcs.bucket("familiar-chat")
                                        .upload(
                                            req.file.path,
                                            {
                                                destination,
                                                public: true,
                                                metadata: {
                                                    contentType: req.file.mimetype
                                                }
                                            }
                                        ).then(_ => 
                                            res.status(201).json({file_path: baseUrl + "/" + destination + "?date=" + new Date().getTime()})
                                        )
                                })
                        })
                })
        } catch (e) {
            return res.status(401).json({message: "Unauthorized"})
        }
    }
)


app.delete(
    "/organizations/:organizationId/visitors/:visitorId/received_messages/image/:imageFileName",
    (req, res) => {
        try {
            getDecodedIdToken(req)
                .then(decodedIdToken => {
                    admin.database()
                        .ref("/users/" + decodedIdToken.uid + "/organizations/" + req.params.organizationId)
                        .once("value")
                        .then(organizationSnapshot => {
                            let organization = organizationSnapshot.val()

                            if(organization == null || organization.user_id == null)
                                return res.status(403).json({message: "forbidden"})
                            
                            admin.database()
                                .ref("/organizations/" + req.params.organizationId + "/users/" + organization.user_id)
                                .once("value")
                                .then(userSnapshot => {
                                    let user = userSnapshot.val()

                                    if(user == null)
                                        return res.status(403).json({message: "forbidden"})
                                    
                                    // if(user.roles == "master")
                                    //     return res.status(401)
                                    
                                    let destination = "organizations/" + req.params.organizationId + "/visitors/" + req.params.imageFileName
                                    gcs.bucket("familiar-chat")
                                        .file(destination)
                                        .delete()
                                        .then(_ =>
                                            res.status(204).json({file_path: baseUrl + "/" + destination})
                                        )
                                })
                        })
                })
        } catch (e) {
            return res.status(401).json({message: "Unauthorized"})
        }
    }
)

///////////////////////////////////////////////////////
// Document Image Endpoint
///////////////////////////////////////////////////////

app.post(
    "/organizations/:organizationId/documents/image",
    upload.single("image_file"),
    (req, res) => {
        try {
            getDecodedIdToken(req)
                .then(decodedIdToken => {
                    admin.database()
                        .ref("/users/" + decodedIdToken.uid + "/organizations/" + req.params.organizationId)
                        .once("value")
                        .then(organizationSnapshot => {
                            let organization = organizationSnapshot.val()

                            if(organization == null || organization.user_id == null)
                                return res.status(403).json({message: "forbidden"})
                            
                            admin.database()
                                .ref("/organizations/" + req.params.organizationId + "/users/" + organization.user_id)
                                .once("value")
                                .then(userSnapshot => {
                                    let user = userSnapshot.val()

                                    if(user == null)
                                        return res.status(403).json({message: "forbidden"})
                                    
                                    // if(user.roles == "master")
                                    //     return res.status(401)
                                    console.log(req)
                                    console.log(req.file)

                                    if(!req.file.mimetype || req.file.mimetype.indexOf("image/") != 0)
                                        return res.status(400).json({message: "content type is not support"})
                                    
                                    let destination = "organizations/" + req.params.organizationId + "/documents/images/" + Math.random().toString(36).slice(-8)
                                    gcs.bucket("familiar-chat")
                                        .upload(
                                            req.file.path,
                                            {
                                                destination,
                                                public: true,
                                                metadata: {
                                                    contentType: req.file.mimetype
                                                }
                                            }
                                        ).then(_ => 
                                            res.status(201).json({file_path: baseUrl + "/" + destination + "?date=" + new Date().getTime()})
                                        )
                                })
                        })
                })
        } catch (e) {
            return res.status(401).json({message: "Unauthorized"})
        }
    }
)

app.delete(
    "/organizations/:organizationId/documents/image/:imageFileName",
    (req, res) => {
        try {
            getDecodedIdToken(req)
                .then(decodedIdToken => {
                    admin.database()
                        .ref("/users/" + decodedIdToken.uid + "/organizations/" + req.params.organizationId)
                        .once("value")
                        .then(organizationSnapshot => {
                            let organization = organizationSnapshot.val()

                            if(organization == null || organization.user_id == null)
                                return res.status(403).json({message: "forbidden"})
                            
                            admin.database()
                                .ref("/organizations/" + req.params.organizationId + "/users/" + organization.user_id)
                                .once("value")
                                .then(userSnapshot => {
                                    let user = userSnapshot.val()

                                    if(user == null)
                                        return res.status(403).json({message: "forbidden"})
                                    
                                    // if(user.roles == "master")
                                    //     return res.status(401)
                                    
                                    let destination = "organizations/" + req.params.organizationId + "/documents/images/" + req.params.imageFileName
                                    gcs.bucket("familiar-chat")
                                        .file(destination)
                                        .delete()
                                        .then(_ =>
                                            res.status(204).json({file_path: baseUrl + "/" + destination})
                                        )
                                })
                        })
                })
        } catch (e) {
            return res.status(401).json({message: "Unauthorized"})
        }
    }
)


///////////////////////////////////////////////////////
// Document Video Endpoint
///////////////////////////////////////////////////////


app.post(
    "/organizations/:organizationId/documents/video",
    upload.single("image_file"),
    (req, res) => {
        try {
            getDecodedIdToken(req)
                .then(decodedIdToken => {
                    admin.database()
                        .ref("/users/" + decodedIdToken.uid + "/organizations/" + req.params.organizationId)
                        .once("value")
                        .then(organizationSnapshot => {
                            let organization = organizationSnapshot.val()

                            if(organization == null || organization.user_id == null)
                                return res.status(403).json({message: "forbidden"})
                            
                            admin.database()
                                .ref("/organizations/" + req.params.organizationId + "/users/" + organization.user_id)
                                .once("value")
                                .then(userSnapshot => {
                                    let user = userSnapshot.val()

                                    if(user == null)
                                        return res.status(403).json({message: "forbidden"})
                                    
                                    // if(user.roles == "master")
                                    //     return res.status(401)

                                    if(!req.file.mimetype || req.file.mimetype.indexOf("video/") != 0)
                                        return res.status(400).json({message: "content type is not support"})
                                    
                                    let destination = "organizations/" + req.params.organizationId + "/documents/videos/" + Math.random().toString(36).slice(-8)
                                    gcs.bucket("familiar-chat")
                                        .upload(
                                            req.file.path,
                                            {
                                                destination,
                                                public: true,
                                                metadata: {
                                                    contentType: req.file.mimetype
                                                }
                                            }
                                        ).then(_ => 
                                            res.status(201).json({file_path: baseUrl + "/" + destination + "?date=" + new Date().getTime()})
                                        )
                                })
                        })
                })
        } catch (e) {
            return res.status(401).json({message: "Unauthorized"})
        }
    }
)

app.delete(
    "/organizations/:organizationId/documents/video/:imageFileName",
    (req, res) => {
        try {
            getDecodedIdToken(req)
                .then(decodedIdToken => {
                    admin.database()
                        .ref("/users/" + decodedIdToken.uid + "/organizations/" + req.params.organizationId)
                        .once("value")
                        .then(organizationSnapshot => {
                            let organization = organizationSnapshot.val()

                            if(organization == null || organization.user_id == null)
                                return res.status(403).json({message: "forbidden"})
                            
                            admin.database()
                                .ref("/organizations/" + req.params.organizationId + "/users/" + organization.user_id)
                                .once("value")
                                .then(userSnapshot => {
                                    let user = userSnapshot.val()

                                    if(user == null)
                                        return res.status(403).json({message: "forbidden"})
                                    
                                    // if(user.roles == "master")
                                    //     return res.status(401)
                                    
                                    let destination = "organizations/" + req.params.organizationId + "/documents/videos/" + req.params.imageFileName
                                    gcs.bucket("familiar-chat")
                                        .file(destination)
                                        .delete()
                                        .then(_ =>
                                            res.status(204).json({file_path: baseUrl + "/" + destination})
                                        )
                                })
                        })
                })
        } catch (e) {
            return res.status(401).json({message: "Unauthorized"})
        }
    }
)


exports.v1 = functions.https.onRequest(app);
