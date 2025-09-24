import { CronJob } from "cron";
import chat from "./chat.js";
import daily from "./daily.js";

const cronjobs = [chat, daily];

const runCronJobs = () => {
  cronjobs.forEach((cron) => {
    const { time, task } = cron;
    const job = new CronJob(time, task, null, true, "Africa/Monrovia");
    job.start();
  });
};

export default runCronJobs;
