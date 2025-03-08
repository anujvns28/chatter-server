const User = require("../model/user");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { uploadImageToCloudinary } = require("../utils/imageUploader");

// signup
exports.signUp = async (req, res) => {
  try {
    //fetchin data
    const { name, username, password, email } = req.body;

    const avatar = req.files.image;

    if (!name || !username || !password || !email || !avatar) {
      return res.status(403).send({
        success: false,
        message: "All Fields are required",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ username: username });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "username already exists. Please sign in to continue.",
      });
    }
    const avatarUrl = await uploadImageToCloudinary(avatar);

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      username: username,
      password: hashedPassword,
      email: email,
      bio: null,
      profilePic: avatarUrl.secure_url,
    });

    const token = jwt.sign(
      { username: username, _id: user._id },
      process.env.JWT_SECRET
    );

    console.log("token--------", token);

    return res.cookie("token", token).status(200).json({
      success: true,
      user,
      token,
      message: "User registered successfully",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Error occerured in Signup form",
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check if email or password is missing
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: `Please Fill up All the Required Fields`,
      });
    }

    // Find user with provided email
    const user = await User.findOne({ username: username }).select("+password");

    // If user not found with provided email
    if (!user) {
      return res.status(401).json({
        success: false,
        message: `User is not Registered with Us Please SignUp to Continue`,
      });
    }

    //  Compare Password
    if (await bcrypt.compare(password, user.password)) {
      const token = jwt.sign(
        { username: user.username, _id: user._id },
        process.env.JWT_SECRET
      );

      res.cookie("token", token).status(200).json({
        success: true,
        user,
        token,
        message: `User Login Success`,
      });
    } else {
      return res.status(401).json({
        success: false,
        message: `Password is incorrect`,
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: `Login Failure Please Try Again`,
    });
  }
};

exports.logout = (req, res) => {
  const options = {
    expires: 0,
  };

  return res.cookie("token", "", options).status(200).json({
    success: false,
    message: "logout successfully",
  });
};

exports.suggestUserName = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(403).json({
        success: false,
        message: "email is requied",
      });

    if (!email.includes("@")) {
      return res.status(404).json({
        success: false,
        message: "not vallied email",
      });
    }

    const usernames = [];
    let nameCount = 1;
    const mailUserName = email.split("@")[0];
    let name = mailUserName + Math.floor(Math.random() * 100);

    const checkUserNameExist = async (username) => {
      const userData = await User.findOne({ username: username });

      if (!userData) {
        usernames.push(username);
        nameCount++;
        name = mailUserName + Math.floor(Math.random() * 100);
      }
    };

    await checkUserNameExist(mailUserName);

    while (nameCount <= 3) {
      await checkUserNameExist(name);
    }

    return res.status(200).json({
      success: true,
      data: usernames,
    });
  } catch (err) {
    console.log("error occurd in suggesting name", err);
    return res.status(500).json({
      success: false,
      message: "error occurd is suggeting error",
    });
  }
};

exports.isUsernameExist = async (req, res) => {
  try {
    const { username } = req.body;
    console.log(req.body);
    if (!username)
      return res.status(500).json({
        success: false,
        message: "username is requrede",
      });

    const userData = await User.findOne({ username: username });
    if (userData) {
      return res.status(200).json({
        success: false,
      });
    }

    return res.status(200).json({
      success: true,
    });
  } catch (err) {
    console.log("error occurd in suggesting name", err);
    return res.status(500).json({
      success: false,
      message: "error occurd in isUsernameexist",
    });
  }
};
