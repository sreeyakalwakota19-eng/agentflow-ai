const {
    registerUser,
    loginUser,
    getCurrentUser,
} = require("../services/authService");

async function register(req, res, next) {
    try {
        const user = await registerUser(req.body);

        res.status(201).json({
            success: true,
            message: "Account created successfully",
            user,
        });
    } catch (error) {
        next(error);
    }
}

async function login(req, res, next) {
    try {
        const result = await loginUser(req.body);

        res.status(200).json({
            success: true,
            message: "Login successful",
            ...result,
        });
    } catch (error) {
        next(error);
    }
}

async function me(req, res, next) {
    try {
        const user = await getCurrentUser(req.user.userId);

        res.status(200).json({
            success: true,
            user,
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    register,
    login,
    me,
};