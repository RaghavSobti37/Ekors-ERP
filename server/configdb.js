// Update db columns after changing schema structure to remove unused fields
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

// 1. Connect to MongoDB
mongoose.connect("mongodb+srv://kors-superadmin:kors1234@cluster0.ikklapw.mongodb.net/testdb?retryWrites=true&w=majority&appName=Cluster0", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// 2. Load all schema files from /models
const modelsDir = path.join(__dirname, "models");
const modelFiles = fs.readdirSync(modelsDir).filter(file => file.endsWith(".js"));

(async () => {
  try {
    for (const file of modelFiles) {
      const modelPath = path.join(modelsDir, file);
      const modelModule = require(modelPath);
      
      // 3. Get model names from exported objects
      const modelNames = Object.keys(modelModule);

      for (const modelName of modelNames) {
        const Model = modelModule[modelName];

        if (!Model?.schema) continue; // skip if not a valid Mongoose model

        const allowedFields = Object.keys(Model.schema.paths).filter(
          field => !['_id', '__v'].includes(field)
        );

        const docs = await Model.find({});

        for (const doc of docs) {
          let modified = false;

          // 4. Remove fields not in schema
          const docObj = doc.toObject();
          for (const key of Object.keys(docObj)) {
            if (!allowedFields.includes(key) && key !== "_id" && key !== "__v") {
              doc.set(key, undefined, { strict: false });
              modified = true;
            }
          }

          // 5. Apply default values if missing
          for (const key of allowedFields) {
            const pathSchema = Model.schema.paths[key];
            if (doc[key] === undefined && pathSchema?.defaultValue !== undefined) {
              doc[key] = typeof pathSchema.defaultValue === "function"
                ? pathSchema.defaultValue()
                : pathSchema.defaultValue;
              modified = true;
            }
          }

          if (modified) {
            await doc.save();
            console.log(`✅ Updated ${modelName} document: ${doc._id}`);
          }
        }
      }
    }

    console.log("🎉 All collections cleaned and updated.");
  } catch (err) {
    console.error("❌ Error during cleanup:", err);
  } finally {
    mongoose.disconnect();
  }
})();
