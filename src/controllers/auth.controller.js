const userModel = require("../models/user.model")
const jwt = require("jsonwebtoken")
const emailService = require("../services/email.service")

/** 
* - User Register Controller
* - POST /api/auth/register
*/
async function userRegisterController(req, res){
    
    const {email, name, password} = req.body;

    const isExists = await userModel.findOne({
        email: email
    })

    if(isExists){
        return res.status(422).json({
            message: "User already exists with that email",
            status: "failed"
        })
    }

    const user = await userModel.create({
        email, password, name
    })

    // Login → Token Created → Stored → Sent in Requests → Verified → Access Granted
    // Creates a secure token that contains the user’s ID(PAYLOAD - date inside token) and expires in 3 days
    const token = jwt.sign({userId: user._id}, process.env.JWT_SECRET, {expiresIn:"3d"})

    res.cookie("token", token);

    res.status(201).json({
        user:{
            _id: user._id,
            email: user.email,
            name: user.name
        },
        token
    })

    await emailService.sendRegistrationEmail(user.email, user.name);
    
}

/** 
* - User Login Controller
* - POST /api/auth/login
*/
async function userLoginController(req, res){

    const {email, password} = req.body

    const user = await userModel.findOne({email}).select("+password")

    if(!user){
        return res.status(401).json({
            message:"Email or Password is invalid"
        })
    }

    const isValidPassword = await user.comparePassword(password)

    if(!isValidPassword){
        return res.status(401).json({
            message:"Email or Password is invalid"
        }) 
    }

    const token = jwt.sign({userId: user._id}, process.env.JWT_SECRET, {expiresIn:"3d"})

    res.cookie("token", token);

    res.status(200).json({
        user:{
            _id: user._id,
            email: user.email,
            name: user.name
        },
        token
    })

}

module.exports = {
    userRegisterController, userLoginController
}