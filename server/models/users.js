const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const logger = require("../logger"); // Assuming logger is in utils

const roleChangeHistorySchema = new mongoose.Schema(
  {
    oldRole: { type: String, required: true },
    newRole: { type: String, required: true },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    firstname: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      minlength: [2, "First name must be at least 2 characters"],
    },
    lastname: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      minlength: [2, "Last name must be at least 2 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true, // This automatically creates an index
      trim: true,
      lowercase: true,
      validate: {
        validator: function (v) {
          return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(v);
        },
        message: (props) => `${props.value} is not a valid email address!`,
      },
    },
    phone: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          return /^[0-9]{10,15}$/.test(v);
        },
        message: (props) => `${props.value} is not a valid phone number!`,
      },
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [5, "Password must be at least 5 characters"],
    },
    role: {
      type: String,
      enum: ["user", "admin", "super-admin"],
      default: "user",
    },
    roleChangeHistory: [roleChangeHistorySchema],

    isActive: {
      type: Boolean,
      default: true,
    },
    avatarUrl: {
      // Field to store the path to the avatar
      type: String,
      trim: true,
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
      virtuals: true,
    },
    toObject: {
      virtuals: true,
    },
  }
);

// Virtual for full name
userSchema.virtual("fullName").get(function () {
  return `${this.firstname} ${this.lastname}`;
});

// Hash password before saving
userSchema.pre("save", async function (next) {

  if (!this.isModified("password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    logger.log({
      user: { email: this.email },
      page: "User Model",
      action: "Password Hash",
      message: `Password hashing failed for ${this.email}`,
      details: { error: err.message },
      level: "error"
    });
    next(err);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    const isMatch = await bcrypt.compare(candidatePassword, this.password);
    return isMatch;
  } catch (err) {
    throw err;
  }
};

// Method to get safe user object (without sensitive data)
userSchema.methods.getSafeUser = function () {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

const User = mongoose.model("User", userSchema);

module.exports = User;
