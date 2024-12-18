const user = require("../model/user");
const { faker } = require("@faker-js/faker");

exports.createfakeUser = async () => {
  try {
    const allUsers = [];

    for (let i = 0; i <= 30; i++) {
      const temp = user.create({
        name: faker.person.fullName(),
        email: faker.internet.email(),
        username: faker.internet.userName(),
        password: "anuj",
        profilePic: faker.image.avatar(),
      });

      allUsers.push(temp);
    }

    await Promise.all(allUsers);
    process.exit(1);
  } catch (e) {
    conosle.log(e, "error occurd in seeder");
  }
};
