router.post('/signup', async (req, res) => {
    const { firstName, lastName, email, phone, password } = req.body;
  
    try {
      // Check if user exists
      let user = await User.findOne({ email });
      if (user) {
        return res.status(400).json({ message: 'Email already registered' });
      }
  
      // Create new user
      user = new User({
        firstName,
        lastName,
        email,
        phone,
        password
      });
  
      await user.save();
  
      // Create JWT token
      const token = jwt.sign(
        { id: user._id }, 
        process.env.JWT_SECRET, 
        { expiresIn: '1h' }
      );
  
      res.status(201).json({ 
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone
        }
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });