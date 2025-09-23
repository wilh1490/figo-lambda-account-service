import { UserModel } from  "../shared/models/index.js";;

const Index = async () => {
  try {
    const users = await UserModel.find({
      "sfh_account.daily_limit_count": { $gt: 0 },
    });

    users.forEach(async (user) => {
      await UserModel.updateMany(
        { _id: user._id },
        {
          $set: {
            "sfh_account.daily_limit_count": 0,
          },
        }
      );
    });
  } catch (error) {
    console.log(error, "Error at daily cron");
  }
};

export default Index;
