import mongoose from "mongoose";
import { redisClient } from "../redis.js";
import axios from "axios";
import SCREEN_RESPONSES, { FIGO_SCREEN_RESPONSES } from "./responses.js";
import { error_avatar, success_avatar } from "./data.js";
import dayjs from "dayjs";
import fetch from "node-fetch";
import sendpulse from "sendpulse-api";
import BigNumber from "bignumber.js";
import { getSecrets } from "./secrets.js";

const {
  SFH_ENDPOINT,
  SFH_CLIENT_ID,
  SFH_CLIENT_ASSERTION,
  GRAPH_API_TOKEN,
  EVERSEND_ENDPOINT,
  EVERSEND_CLIENT_ID,
  EVERSEND_CLIENT_SECRET,
  WA_PHONE_NUMBER_ID,
  FIGO_WA_PHONE_NUMBER,
  TERMII_KEY,
} = await getSecrets();

export function formatNumberWithCommas(number) {
  return number.toLocaleString("en-US");
}

// Helper to invalidate cache
export const invalidateCache = (key) => {
  redisClient.del(key);
};

export const getScheduleExpression = (date, type) => {
  // extract values for cron
  const minute = date.minute(); // 0
  const hour = date.hour(); // 9
  const day = date.date(); // 3
  const month = date.month() + 1; // dayjs month is 0-indexed
  const year = date.year(); // 2025
  // build cron expression
  let scheduleExpression = "";
  if (type == "cron") {
    scheduleExpression = `cron(${minute} ${hour} ${day} ${month} ? ${year})`;
  }
  if (type == "rate") {
    scheduleExpression = ""; //E.g "rate(5 minutes)"
  }
  return scheduleExpression;
};

export const urlToBase64 = async (url) => {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer", // Ensures we get the raw image data as a buffer
    });
    // Convert the buffer to a base64 string
    const base64Image = Buffer.from(response.data, "binary").toString("base64");
    // Return only the base64 string without any prefix
    return base64Image;
  } catch (error) {
    console.error("Error fetching image:", error);
  }
};

export const fileToBase64 = async (filePath) => {
  try {
    // Read the file from the local filesystem
    const fileData = await fs.promises.readFile(filePath);

    // Convert the file data to a base64 string
    const base64Image = fileData.toString("base64");

    // Return the base64 string without any prefix
    return base64Image;
  } catch (error) {
    console.error("Error reading file:", error);
  }
};

export const AmountSeparator = (amount) => {
  const separate = (amount) => {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };
  const rounding = (Math.round(amount * 100) / 100).toFixed(2);
  const cal = separate(rounding);
  return cal;
};

export const formatDate = (date, format) => dayjs(date).format(format); //format sample MMM DD, YYYY. h:mm a

export function formatDay(dateString) {
  const date = new Date(dateString);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const dayOfWeek = days[date.getDay()];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();

  return `${dayOfWeek} ${month} ${day}, ${year}`;
}

export const Sfh_Token = async () => {
  const sfh_access_token = await redisClient.get("sfh_access_token");

  if (sfh_access_token) {
    console.log(sfh_access_token, "Old Token");
    return sfh_access_token;
  } else {
    let createAccessToken = await fetch(`${SFH_ENDPOINT}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_assertion: SFH_CLIENT_ASSERTION,
        client_assertion_type:
          "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        client_id: SFH_CLIENT_ID,
        grant_type: "client_credentials",
      }),
    });

    createAccessToken = await createAccessToken.json();

    console.log(createAccessToken, "New Token");

    if (createAccessToken?.access_token)
      await redisClient.set(
        "sfh_access_token",
        createAccessToken.access_token,
        {
          EX: 1800,
          NX: true,
        }
      );
    // const ttl = await redisClient.ttl("sfh_access_token");
    // console.log("TTL for sfh_access_token:", ttl);
    return createAccessToken.access_token;
  }
};

export const Eversend_Token = async () => {
  const eversend_access_token = await redisClient.get("eversend_access_token");
  if (eversend_access_token) {
    console.log(eversend_access_token, "Eversend Token");
    return eversend_access_token;
  } else {
    let createAccessToken = await fetch(`${EVERSEND_ENDPOINT}/auth/token`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        clientId: EVERSEND_CLIENT_ID,
        clientSecret: EVERSEND_CLIENT_SECRET,
      },
    });

    createAccessToken = await createAccessToken.json();

    console.log(createAccessToken, "Eversend Token");

    if (createAccessToken?.token)
      await redisClient.set("eversend_access_token", createAccessToken.token, {
        EX: 3000,
        NX: true,
      });
    // const ttl = await redisClient.ttl("eversend_access_token");
    // console.log("TTL for eversend_access_token:", ttl);
    return createAccessToken.token;
  }
};

export const termiiOTP = async ({ to }) => {
  try {
    let url = "https://api.ng.termii.com/api/sms/otp/send";
    const response = await axios({
      method: "POST",
      url,
      headers: {
        "Content-Type": "application/json",
      },
      data: JSON.stringify({
        api_key: TERMII_KEY,
        message_type: "ALPHANUMERIC",
        to,
        from: "Slashit",
        channel: "generic",
        pin_attempts: 3,
        pin_time_to_live: 10,
        pin_length: 6,
        pin_placeholder: "< 123456 >",
        message_text:
          "< 123456 > is your Carrot verification code. Don't share it with anyone.",
        pin_type: "NUMERIC",
      }),
    });
    console.log(response.data);
    return response.data;
  } catch (error) {}
};

export const termiiVerify = async ({ pin, pin_id }) => {
  try {
    let url = "https://api.ng.termii.com/api/sms/otp/verify";
    const response = await axios({
      method: "POST",
      url,
      headers: {
        "Content-Type": "application/json",
      },
      data: JSON.stringify({
        api_key: TERMII_KEY,
        pin_id,
        pin,
      }),
    });
    console.log(response.data);
    return response.data;
  } catch (error) {}
};

export function maskString(str) {
  // Replace all characters except the last 4 with '*'
  return str.slice(0, -4).replace(/./g, "*") + str.slice(-4);
}

export const SuccessScreen = (data) => {
  return {
    screen: SCREEN_RESPONSES.PRIMARY_FINISH.screen,
    data: {
      ...FIGO_SCREEN_RESPONSES.PRIMARY_FINISH.data,
      ...data,
      image: data.avatar || success_avatar,
    },
  };
};

export const ErrorScreen = (data) => {
  return {
    screen: SCREEN_RESPONSES.PRIMARY_FINISH.screen,
    data: {
      ...FIGO_SCREEN_RESPONSES.PRIMARY_FINISH.data,
      ...data,
      image: error_avatar,
    },
  };
};

export const UpdateRequiredScreen = ({ data }) => {
  return {
    screen: SCREEN_RESPONSES.UPDATE_REQUIRED.screen,
    data: {
      ...SCREEN_RESPONSES.UPDATE_REQUIRED.data,
      ...data,
    },
  };
};

export const computeLastSeen = (last_seen) => {
  //if no last_seen
  if (!last_seen) return false;
  const lastSeen = new Date(last_seen); // Replace with your last_seen timestamp
  const now = new Date(); // Current time

  // Calculate the time difference in hours
  const hs = (now - lastSeen) / (1000 * 60 * 60); // Convert from ms to h

  if (hs < 24) {
    return true;
  } else {
    return false;
  }
};

export const sendMail = async ({
  fullName,
  to,
  subject,
  body,
  host_name,
  host_email,
}) => {
  const API_SECRET = `1b7dafae40f7d6f2d9b3f5c5dc6fd9c9`;
  const API_USER_ID = `92254ffb02fae4bddcefabaf74c444f9`;
  const TOKEN_STORAGE = "/tmp/";

  const msg = {
    from: {
      name: host_name,
      email: host_email,
    },
    to: [
      {
        name: fullName || "You",
        email: to,
      },
    ],
    subject: `${subject}`,
    html: body,
  };

  const answerGetter = () => {
    //
  };

  return sendpulse.init(
    API_USER_ID,
    API_SECRET,
    TOKEN_STORAGE,
    async function (token) {
      if (token && token.is_error) {
        // error handling
        console.log(token || "");
      }
      sendpulse.smtpSendMail(answerGetter, msg);
    }
  );
};

export const emailOTPTemplate = (otp) =>
  `
  <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><html dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en" style="font-family:helvetica, 'helvetica neue', arial, verdana, sans-serif"><head><meta charset="UTF-8"><meta content="width=device-width, initial-scale=1" name="viewport"><meta name="x-apple-disable-message-reformatting"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta content="telephone=no" name="format-detection"><title>Email verification</title><!--[if (mso 16)]><style type="text/css">     a {text-decoration: none;}     </style><![endif]--><!--[if gte mso 9]><style>sup { font-size: 100% !important; }</style><![endif]--><!--[if gte mso 9]><xml> <o:OfficeDocumentSettings> <o:AllowPNG></o:AllowPNG> <o:PixelsPerInch>96</o:PixelsPerInch> </o:OfficeDocumentSettings> </xml>
<![endif]--><!--[if !mso]><!-- --><link href="https://fonts.googleapis.com/css?family=Open+Sans:400,400i,700,700i" rel="stylesheet"><link href="https://fonts.googleapis.com/css?family=Roboto:400,400i,700,700i" rel="stylesheet"><!--<![endif]--><style type="text/css">#outlook a { padding:0;}.es-button { mso-style-priority:100!important; text-decoration:none!important;}a[x-apple-data-detectors] { color:inherit!important; text-decoration:none!important; font-size:inherit!important; font-family:inherit!important; font-weight:inherit!important; line-height:inherit!important;}.es-desk-hidden { display:none; float:left; overflow:hidden; width:0; max-height:0; line-height:0; mso-hide:all;}.es-button-border:hover a.es-button, .es-button-border:hover button.es-button { background:#ad2cdc!important;}.es-button-border:hover { border-color:#42d159 #42d159 #42d159 #42d159!important; background:#ad2cdc!important;}
@media only screen and (max-width:600px) {p, ul li, ol li, a { line-height:150%!important } h1, h2, h3, h1 a, h2 a, h3 a { line-height:120%!important } h1 { font-size:22px!important; text-align:left } h2 { font-size:22px!important; text-align:center } h3 { font-size:22px!important; text-align:center } .es-header-body h1 a, .es-content-body h1 a, .es-footer-body h1 a { font-size:22px!important; text-align:left } .es-header-body h2 a, .es-content-body h2 a, .es-footer-body h2 a { font-size:22px!important } .es-header-body h3 a, .es-content-body h3 a, .es-footer-body h3 a { font-size:22px!important } .es-menu td a { font-size:14px!important } .es-header-body p, .es-header-body ul li, .es-header-body ol li, .es-header-body a { font-size:12px!important } .es-content-body p, .es-content-body ul li, .es-content-body ol li, .es-content-body a { font-size:12px!important }
 .es-footer-body p, .es-footer-body ul li, .es-footer-body ol li, .es-footer-body a { font-size:12px!important } .es-infoblock p, .es-infoblock ul li, .es-infoblock ol li, .es-infoblock a { font-size:12px!important } *[class="gmail-fix"] { display:none!important } .es-m-txt-c, .es-m-txt-c h1, .es-m-txt-c h2, .es-m-txt-c h3 { text-align:center!important } .es-m-txt-r, .es-m-txt-r h1, .es-m-txt-r h2, .es-m-txt-r h3 { text-align:right!important } .es-m-txt-l, .es-m-txt-l h1, .es-m-txt-l h2, .es-m-txt-l h3 { text-align:left!important } .es-m-txt-r img, .es-m-txt-c img, .es-m-txt-l img { display:inline!important } .es-button-border { display:inline-block!important } a.es-button, button.es-button { font-size:13px!important; display:inline-block!important } .es-adaptive table, .es-left, .es-right { width:100%!important }
 .es-content table, .es-header table, .es-footer table, .es-content, .es-footer, .es-header { width:100%!important; max-width:600px!important } .es-adapt-td { display:block!important; width:100%!important } .adapt-img { width:100%!important; height:auto!important } .es-m-p0 { padding:0!important } .es-m-p0r { padding-right:0!important } .es-m-p0l { padding-left:0!important } .es-m-p0t { padding-top:0!important } .es-m-p0b { padding-bottom:0!important } .es-m-p20b { padding-bottom:20px!important } .es-mobile-hidden, .es-hidden { display:none!important } tr.es-desk-hidden, td.es-desk-hidden, table.es-desk-hidden { width:auto!important; overflow:visible!important; float:none!important; max-height:inherit!important; line-height:inherit!important } tr.es-desk-hidden { display:table-row!important } table.es-desk-hidden { display:table!important } td.es-desk-menu-hidden { display:table-cell!important } .es-menu td { width:1%!important }
 table.es-table-not-adapt, .esd-block-html table { width:auto!important } table.es-social { display:inline-block!important } table.es-social td { display:inline-block!important } .es-m-p5 { padding:5px!important } .es-m-p5t { padding-top:5px!important } .es-m-p5b { padding-bottom:5px!important } .es-m-p5r { padding-right:5px!important } .es-m-p5l { padding-left:5px!important } .es-m-p10 { padding:10px!important } .es-m-p10t { padding-top:10px!important } .es-m-p10b { padding-bottom:10px!important } .es-m-p10r { padding-right:10px!important } .es-m-p10l { padding-left:10px!important } .es-m-p15 { padding:15px!important } .es-m-p15t { padding-top:15px!important } .es-m-p15b { padding-bottom:15px!important } .es-m-p15r { padding-right:15px!important } .es-m-p15l { padding-left:15px!important } .es-m-p20 { padding:20px!important } .es-m-p20t { padding-top:20px!important } .es-m-p20r { padding-right:20px!important }
 .es-m-p20l { padding-left:20px!important } .es-m-p25 { padding:25px!important } .es-m-p25t { padding-top:25px!important } .es-m-p25b { padding-bottom:25px!important } .es-m-p25r { padding-right:25px!important } .es-m-p25l { padding-left:25px!important } .es-m-p30 { padding:30px!important } .es-m-p30t { padding-top:30px!important } .es-m-p30b { padding-bottom:30px!important } .es-m-p30r { padding-right:30px!important } .es-m-p30l { padding-left:30px!important } .es-m-p35 { padding:35px!important } .es-m-p35t { padding-top:35px!important } .es-m-p35b { padding-bottom:35px!important } .es-m-p35r { padding-right:35px!important } .es-m-p35l { padding-left:35px!important } .es-m-p40 { padding:40px!important } .es-m-p40t { padding-top:40px!important } .es-m-p40b { padding-bottom:40px!important } .es-m-p40r { padding-right:40px!important } .es-m-p40l { padding-left:40px!important }
 .es-desk-hidden { display:table-row!important; width:auto!important; overflow:visible!important; max-height:inherit!important } }</style>
</head><body style="width:100%;font-family:helvetica, 'helvetica neue', arial, verdana, sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;padding:0;Margin:0"><div dir="ltr" class="es-wrapper-color" lang="en" style="background-color:#FAFAFA"><!--[if gte mso 9]><v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="t"> <v:fill type="tile" color="#fafafa"></v:fill> </v:background><![endif]--><table class="es-wrapper" width="100%" cellspacing="0" cellpadding="0" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;padding:0;Margin:0;width:100%;height:100%;background-repeat:repeat;background-position:center top;background-color:#FAFAFA"><tr>
<td valign="top" style="padding:0;Margin:0"><table cellpadding="0" cellspacing="0" class="es-header" align="center" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;table-layout:fixed !important;width:100%;background-color:transparent;background-repeat:repeat;background-position:center top"><tr><td align="center" style="padding:0;Margin:0"><table bgcolor="#ffffff" class="es-header-body" align="center" cellpadding="0" cellspacing="0" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;background-color:#FFFFFF;width:400px"><tr><td align="left" style="Margin:0;padding-top:10px;padding-bottom:10px;padding-left:20px;padding-right:20px"><table cellpadding="0" cellspacing="0" width="100%" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tr>
<td class="es-m-p0r" valign="top" align="center" style="padding:0;Margin:0;width:360px"><table cellpadding="0" cellspacing="0" width="100%" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tr><td align="center" style="padding:0;Margin:0;padding-top:10px;padding-bottom:10px;padding-right:35px;font-size:0px"><img src="https://figoassets.s3.us-east-1.amazonaws.com/moringa-logo-174550410945" alt style="display:block;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic" width="50"></td></tr></table></td></tr></table></td></tr></table></td></tr></table><table cellpadding="0" cellspacing="0" class="es-content" align="center" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;table-layout:fixed !important;width:100%"><tr>
<td class="es-info-area" align="center" style="padding:0;Margin:0"><table bgcolor="#ffffff" class="es-content-body" align="center" cellpadding="0" cellspacing="0" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;background-color:#FFFFFF;width:400px"><tr><td align="left" style="Margin:0;padding-top:10px;padding-left:20px;padding-right:20px;padding-bottom:40px"><table cellpadding="0" cellspacing="0" width="100%" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tr><td align="left" style="padding:0;Margin:0;width:360px"><table cellpadding="0" cellspacing="0" width="100%" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tr>
<td align="left" class="es-infoblock" style="padding:0;Margin:0;padding-bottom:5px;line-height:18px;font-size:12px;color:#333333"><p style="Margin:0;-webkit-text-size-adjust:none;-ms-text-size-adjust:none;mso-line-height-rule:exactly;font-family:'open sans', 'helvetica neue', helvetica, arial, sans-serif;line-height:23px;color:#333333;font-size:13px"><span style="color:#000000">Hello,</span><br><br><font color="#000000">Your Moringa code is:</font><br><br><span style="color:#9732FD;font-size:15px">${otp}</span><br><br><br><br></p></td></tr></table></td></tr></table></td></tr></table></td></tr></table><table cellpadding="0" cellspacing="0" class="es-footer" align="center" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;table-layout:fixed !important;width:100%;background-color:transparent;background-repeat:repeat;background-position:center top"><tr>
<td align="center" style="padding:0;Margin:0"><table class="es-footer-body" align="center" cellpadding="0" cellspacing="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;background-color:transparent;width:400px" role="none"><tr><td align="left" bgcolor="#ffffff" style="Margin:0;padding-top:20px;padding-bottom:20px;padding-left:20px;padding-right:20px;background-color:#ffffff"><table cellpadding="0" cellspacing="0" width="100%" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tr><td align="left" style="padding:0;Margin:0;width:360px"><table cellpadding="0" cellspacing="0" width="100%" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tr>
<td align="center" style="padding:0;Margin:0;padding-top:15px;padding-bottom:15px;font-size:0"><table cellpadding="0" cellspacing="0" class="es-table-not-adapt es-social" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tr><td align="center" valign="top" style="padding:0;Margin:0;padding-right:40px"><a target="_blank" href="http://www.twitter.com/" style="-webkit-text-size-adjust:none;-ms-text-size-adjust:none;mso-line-height-rule:exactly;text-decoration:underline;color:#333333;font-size:12px"><img title="Twitter" src="https://lvdqpp.stripocdn.email/content/assets/img/social-icons/circle-black-bordered/twitter-circle-black-bordered.png" alt="Moringa on Twitter" width="32" style="display:block;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic"></a></td>
<td align="center" valign="top" style="padding:0;Margin:0"><a target="_blank" href="https://instagram.com/" style="-webkit-text-size-adjust:none;-ms-text-size-adjust:none;mso-line-height-rule:exactly;text-decoration:underline;color:#333333;font-size:12px"><img title="Instagram" src="https://lvdqpp.stripocdn.email/content/assets/img/social-icons/circle-black-bordered/instagram-circle-black-bordered.png" alt="Moringa on Insta" width="32" style="display:block;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic"></a></td></tr></table></td></tr></table></td></tr></table></td></tr></table></td></tr></table><table cellpadding="0" cellspacing="0" class="es-content" align="center" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;table-layout:fixed !important;width:100%"><tr>
<td class="es-info-area" align="center" style="padding:0;Margin:0"><table class="es-content-body" align="center" cellpadding="0" cellspacing="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;background-color:transparent;width:400px" bgcolor="#FFFFFF" role="none"><tr><td align="left" style="padding:20px;Margin:0"><table cellpadding="0" cellspacing="0" width="100%" role="none" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tr><td align="center" valign="top" style="padding:0;Margin:0;width:360px"><table cellpadding="0" cellspacing="0" width="100%" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tr>
<td align="center" class="es-infoblock" style="padding:0;Margin:0;line-height:30px;font-size:12px;color:#333333"><p style="Margin:0;-webkit-text-size-adjust:none;-ms-text-size-adjust:none;mso-line-height-rule:exactly;font-family:roboto, 'helvetica neue', helvetica, arial, sans-serif;line-height:30px;color:#333333;font-size:25px"><strong>Moringa</strong></p></td></tr></table></td></tr></table></td></tr></table></td></tr></table></td></tr></table></div></body></html>
`;

export const MoringWalletKeys = [
  { name: "binance", asset: "USDT_BSC", wallet: "USDT" },
  { name: "ethereum", asset: "USDT_ERC20", wallet: "USDT" },
  { name: "polygon", asset: "USDT_POLYGON", wallet: "USDT" },
  { name: "tron", asset: "TRX_USDT_S2UZ", wallet: "USDT" },
  { name: "solana", asset: "SOL_USDT_EWAY", wallet: "USDT" },
  { name: "optimism", asset: "USDT", wallet: "USDT" },
  { name: "arbitrum", asset: "USDT_ARB", wallet: "USDT" },

  { name: "ethereum", asset: "USDC", wallet: "USDC" },
  { name: "polygon", asset: "USDC_POLYGON", wallet: "USDC" },
  { name: "stellar", asset: "XLM_USDC_5F3T", wallet: "USDC" },
  { name: "base", asset: "USDC_BASECHAIN_ETH_5I5C", wallet: "USDC" },
  { name: "solana", asset: "SOL_USDC_PTHX", wallet: "USDC" },
  { name: "optimism", asset: "USDC_OPT_9T08", wallet: "USDC" },
  { name: "binance", asset: "USDC_BSC", wallet: "USDC" },
  { name: "arbitrum", asset: "USDC_ARB_3SBJ", wallet: "USDC" },
];

export const MoringaFees = [
  { name: "binance", asset: "USDT_BSC", fee: 0.4 },
  { name: "ethereum", asset: "USDT_ERC20", fee: 6 },
  { name: "polygon", asset: "USDT_POLYGON", fee: 0.3 },
  { name: "tron", asset: "TRX_USDT_S2UZ", fee: 3 },
  { name: "solana", asset: "SOL_USDT_EWAY", fee: 2 },
  { name: "optimism", asset: "USDT", fee: 0.3 },
  { name: "arbitrum", asset: "USDT_ARB", fee: 0.3 },
  { name: "ethereum", asset: "USDC", fee: 6 },
  { name: "polygon", asset: "USDC_POLYGON", fee: 0.3 },
  { name: "stellar", asset: "XLM_USDC_5F3T", fee: 1 },
  { name: "base", asset: "USDC_BASECHAIN_ETH_5I5C", fee: 0.2 },
  { name: "solana", asset: "SOL_USDC_PTHX", fee: 2 },
  { name: "optimism", asset: "USDC_OPT_9T08", fee: 0.3 },
  { name: "binance", asset: "USDC_BSC", fee: 0.4 },
  { name: "arbitrum", asset: "USDC_ARB_3SBJ", fee: 0.3 },
];

export const paginateList = (array, current_page, limit, keyword) => {
  // Filter the array based on the keyword
  const filteredArray = keyword
    ? array.filter(
        (item) =>
          item.metadata.toLowerCase().includes(keyword.toLowerCase()) ||
          item.reference.toLowerCase().includes(keyword.toLowerCase())
      )
    : array;

  const totalCount = filteredArray.length;
  const skip = current_page * limit;
  const paginatedData = filteredArray.slice(skip, skip + limit);
  const hasNext = skip + paginatedData.length < totalCount;
  const hasPrevious = current_page > 0;

  return {
    data: paginatedData,
    totalCount,
    hasNext,
    hasPrevious,
    range: `${current_page * limit + 1} - ${limit * (current_page + 1)}`,
  };
};

export function parseNestedJsonFromTextField(text) {
  try {
    // Step 1: Remove extra wrapping quotes if present (e.g., """...""")
    const cleaned = text.replace(/^"+|"+$/g, "");

    // Step 2: First parse — converts escaped string to a JSON string
    const firstParse = JSON.parse(cleaned);

    // Step 3: If the result is still a string, parse it again
    return typeof firstParse === "string" ? JSON.parse(firstParse) : firstParse;
  } catch (err) {
    console.error("Failed to parse nested JSON:", err);
    return {};
  }
}

export function fromNairaToKobo(naira) {
  return mongoose.Types.Long.fromNumber(
    new BigNumber(naira).multipliedBy(100).toNumber()
  );
}

export function fromKoboToNaira(kobo = 0) {
  return parseFloat(kobo) / 100;
}

export function toTimeZone(date, timeZone, format) {
  let tz = timeZone || "Africa/Lagos";

  return dayjs(
    new Date(date).toLocaleString("en-US", {
      timeZone: tz,
    })
  ).format(format || "ddd-MMM-DD-YYYY");
}

export const sendToWA = async ({ message, wa_id, PHONE_NUMBER_ID }) => {
  await axios({
    method: "POST",
    url: `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`,
    headers: {
      Authorization: `Bearer ${GRAPH_API_TOKEN}`,
    },
    data: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: wa_id,
      type: "text",
      text: {
        body: `*${message}*`,
      },
    },
  });
};

export const sendImageToWA = async ({
  wa_id,
  PHONE_NUMBER_ID,
  caption,
  url,
}) => {
  await axios({
    method: "POST",
    url: `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`,
    headers: {
      Authorization: `Bearer ${GRAPH_API_TOKEN}`,
    },
    data: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: wa_id,
      type: "image",
      image: {
        link: url,
        caption: caption || "",
      },
    },
  });
};

export const SendFigoReminder = async ({ wa_id, header, body }) => {
  await axios({
    method: "POST",
    url: `https://graph.facebook.com/v23.0/${FIGO_WA_PHONE_NUMBER}/messages`,
    headers: {
      Authorization: `Bearer ${GRAPH_API_TOKEN}`,
    },
    data: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: wa_id,
      type: "template",
      template: {
        name: "figo_reminder",
        language: {
          code: "en",
        },
        components: [
          {
            type: "header",
            parameters: [
              {
                type: "text",
                text: header,
              },
            ],
          },
          {
            type: "body",
            parameters: [
              {
                type: "text",
                text: body,
              },
            ],
          },
        ],
      },
    },
  });
};

export const SendFigoInvitation = async ({
  wa_id,
  header,
  body,
  message,
  name,
  mobile,
  flow_token,
  account_id,
}) => {
  await axios({
    method: "POST",
    url: `https://graph.facebook.com/v23.0/${FIGO_WA_PHONE_NUMBER}/messages`,
    headers: {
      Authorization: `Bearer ${GRAPH_API_TOKEN}`,
    },
    data: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: wa_id,
      type: "template",
      template: {
        name: "figo_staff_invite",
        language: {
          code: "en",
        },
        components: [
          {
            type: "header",
            parameters: [
              {
                type: "text",
                text: header,
              },
            ],
          },
          {
            type: "body",
            parameters: [
              {
                type: "text",
                text: body,
              },
            ],
          },
          {
            type: "button",
            sub_type: "flow",
            index: "0",
            parameters: [
              {
                type: "action",
                action: {
                  flow_token: flow_token,
                  flow_action_data: {
                    message,
                    agreed: false,
                    name,
                    mobile,
                    account_id,
                  },
                },
              },
            ],
          },
        ],
      },
    },
  });
};
