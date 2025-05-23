const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
    firstname: {
        type: String,
        required: [true, "First name is required"],
        trim: true,
        minlength: [2, "First name must be at least 2 characters"]
    },
    lastname: {
        type: String,
        required: [true, "Last name is required"],
        trim: true,
        minlength: [2, "Last name must be at least 2 characters"]
    },
    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,  // This automatically creates an index
        trim: true,
        lowercase: true,
        validate: {
            validator: function(v) {
                return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(v);
            },
            message: props => `${props.value} is not a valid email address!`
        }
    },
    phone: {
        type: String,
        trim: true,
        validate: {
            validator: function(v) {
                return /^[0-9]{10,15}$/.test(v);
            },
            message: props => `${props.value} is not a valid phone number!`
        }
    },
    password: {
        type: String,
        required: [true, "Password is required"],
        minlength: [6, "Password must be at least 6 characters"],
    },
    role: {
        type: String,
        enum: ["user", "admin", "super-admin"],
        default: "user"
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date
    }
}, {
    timestamps: true,
    toJSON: {
        transform: function(doc, ret) {
            delete ret.password;
            delete ret.__v;
            return ret;
        },
        virtuals: true
    },
    toObject: {
        virtuals: true
    }
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
    return `${this.firstname} ${this.lastname}`;
});

// Hash password before saving
userSchema.pre("save", async function(next) {
    console.log("[DEBUG] Running pre-save hook for user:", this.email);
    
    if (!this.isModified("password")) {
        console.log("[DEBUG] Password not modified, skipping hash");
        return next();
    }
    
    try {
        console.log("[DEBUG] Hashing password for user:", this.email);
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        console.error("[ERROR] Password hashing failed:", err);
        next(err);
    }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
    console.log("[DEBUG] Comparing passwords for user:", this.email);
    try {
        const isMatch = await bcrypt.compare(candidatePassword, this.password);
        console.log("[DEBUG] Password comparison result:", isMatch);
        return isMatch;
    } catch (err) {
        console.error("[ERROR] Password comparison failed:", err);
        throw err;
    }
};

// Method to get safe user object (without sensitive data)
userSchema.methods.getSafeUser = function() {
    const userObject = this.toObject();
    delete userObject.password;
    return userObject;
};

const User = mongoose.model("User", userSchema);

module.exports = User;