import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import axios from "axios";
import { generatePdfFromHtml } from "./index.js";
import { getSecrets } from "../shared/config/secrets.js";

// Configure the AWS S3 client
const { AWS_REGION, S3_BUCKET, WA_PHONE_NUMBER_ID, GRAPH_API_TOKEN } =
  await getSecrets();

const s3 = new S3Client({ region: AWS_REGION });

export async function DepositTemplate(data, browser) {
  try {
    const { misc, payment_ref, amount, date, status, user } = data;

    const htmlContent = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
    <html
      dir="ltr"
      xmlns="http://www.w3.org/1999/xhtml"
      xmlns:o="urn:schemas-microsoft-com:office:office"
      lang="en"
      style="font-family: helvetica, 'helvetica neue', arial, verdana, sans-serif"
    >
      <head>
        <meta charset="UTF-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <meta name="x-apple-disable-message-reformatting" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta content="telephone=no" name="format-detection" />
        <title>Carrot Receipt</title>
        <!--[if (mso 16)
          ]><style type="text/css">
            a {
              text-decoration: none;
            }
          </style><!
        [endif]-->
        <!--[if gte mso 9
          ]><style>
            sup {
              font-size: 100% !important;
            }
          </style><!
        [endif]-->
        <!--[if gte mso 9
          ]><noscript>
            <xml>
              <o:OfficeDocumentSettings>
                <o:AllowPNG></o:AllowPNG> <o:PixelsPerInch>96</o:PixelsPerInch>
              </o:OfficeDocumentSettings>
            </xml>
          </noscript>
        <![endif]-->
        <!--[if !mso]><!-- -->
        <link
          href="https://fonts.googleapis.com/css?family=Lato:400,400i,700,700i"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css?family=Open+Sans:400,400i,700,700i"
          rel="stylesheet"
        />
        <!--<![endif]-->
        <style type="text/css">
          #outlook a {
            padding: 0;
          }
          .es-button {
            mso-style-priority: 100 !important;
            text-decoration: none !important;
          }
          a[x-apple-data-detectors] {
            color: inherit !important;
            text-decoration: none !important;
            font-size: inherit !important;
            font-family: inherit !important;
            font-weight: inherit !important;
            line-height: inherit !important;
          }
          .es-desk-hidden {
            display: none;
            float: left;
            overflow: hidden;
            width: 0;
            max-height: 0;
            line-height: 0;
            mso-hide: all;
          }
          .es-button-border:hover a.es-button,
          .es-button-border:hover button.es-button {
            background: #ad2cdc !important;
          }
          .es-button-border:hover {
            border-color: #42d159 #42d159 #42d159 #42d159 !important;
            background: #ad2cdc !important;
          }
          @media only screen and (max-width: 600px) {
            p,
            ul li,
            ol li,
            a {
              line-height: 150% !important;
            }
            h1,
            h2,
            h3,
            h1 a,
            h2 a,
            h3 a {
              line-height: 120% !important;
            }
            h1 {
              font-size: 22px !important;
              text-align: left;
            }
            h2 {
              font-size: 22px !important;
              text-align: center;
            }
            h3 {
              font-size: 22px !important;
              text-align: center;
            }
            .es-header-body h1 a,
            .es-content-body h1 a,
            .es-footer-body h1 a {
              font-size: 22px !important;
              text-align: left;
            }
            .es-header-body h2 a,
            .es-content-body h2 a,
            .es-footer-body h2 a {
              font-size: 22px !important;
            }
            .es-header-body h3 a,
            .es-content-body h3 a,
            .es-footer-body h3 a {
              font-size: 22px !important;
            }
            .es-menu td a {
              font-size: 14px !important;
            }
            .es-header-body p,
            .es-header-body ul li,
            .es-header-body ol li,
            .es-header-body a {
              font-size: 12px !important;
            }
            .es-content-body p,
            .es-content-body ul li,
            .es-content-body ol li,
            .es-content-body a {
              font-size: 12px !important;
            }
            .es-footer-body p,
            .es-footer-body ul li,
            .es-footer-body ol li,
            .es-footer-body a {
              font-size: 12px !important;
            }
            .es-infoblock p,
            .es-infoblock ul li,
            .es-infoblock ol li,
            .es-infoblock a {
              font-size: 12px !important;
            }
            *[class="gmail-fix"] {
              display: none !important;
            }
            .es-m-txt-c,
            .es-m-txt-c h1,
            .es-m-txt-c h2,
            .es-m-txt-c h3 {
              text-align: center !important;
            }
            .es-m-txt-r,
            .es-m-txt-r h1,
            .es-m-txt-r h2,
            .es-m-txt-r h3 {
              text-align: right !important;
            }
            .es-m-txt-l,
            .es-m-txt-l h1,
            .es-m-txt-l h2,
            .es-m-txt-l h3 {
              text-align: left !important;
            }
            .es-m-txt-r img,
            .es-m-txt-c img,
            .es-m-txt-l img {
              display: inline !important;
            }
            .es-button-border {
              display: inline-block !important;
            }
            a.es-button,
            button.es-button {
              font-size: 13px !important;
              display: inline-block !important;
            }
            .es-adaptive table,
            .es-left,
            .es-right {
              width: 100% !important;
            }
            .es-content table,
            .es-header table,
            .es-footer table,
            .es-content,
            .es-footer,
            .es-header {
              width: 100% !important;
              max-width: 600px !important;
            }
            .es-adapt-td {
              display: block !important;
              width: 100% !important;
            }
            .adapt-img {
              width: 100% !important;
              height: auto !important;
            }
            .es-m-p0 {
              padding: 0 !important;
            }
            .es-m-p0r {
              padding-right: 0 !important;
            }
            .es-m-p0l {
              padding-left: 0 !important;
            }
            .es-m-p0t {
              padding-top: 0 !important;
            }
            .es-m-p0b {
              padding-bottom: 0 !important;
            }
            .es-m-p20b {
              padding-bottom: 20px !important;
            }
            .es-mobile-hidden,
            .es-hidden {
              display: none !important;
            }
            tr.es-desk-hidden,
            td.es-desk-hidden,
            table.es-desk-hidden {
              width: auto !important;
              overflow: visible !important;
              float: none !important;
              max-height: inherit !important;
              line-height: inherit !important;
            }
            tr.es-desk-hidden {
              display: table-row !important;
            }
            table.es-desk-hidden {
              display: table !important;
            }
            td.es-desk-menu-hidden {
              display: table-cell !important;
            }
            .es-menu td {
              width: 1% !important;
            }
            table.es-table-not-adapt,
            .esd-block-html table {
              width: auto !important;
            }
            table.es-social {
              display: inline-block !important;
            }
            table.es-social td {
              display: inline-block !important;
            }
            .es-m-p5 {
              padding: 5px !important;
            }
            .es-m-p5t {
              padding-top: 5px !important;
            }
            .es-m-p5b {
              padding-bottom: 5px !important;
            }
            .es-m-p5r {
              padding-right: 5px !important;
            }
            .es-m-p5l {
              padding-left: 5px !important;
            }
            .es-m-p10 {
              padding: 10px !important;
            }
            .es-m-p10t {
              padding-top: 10px !important;
            }
            .es-m-p10b {
              padding-bottom: 10px !important;
            }
            .es-m-p10r {
              padding-right: 10px !important;
            }
            .es-m-p10l {
              padding-left: 10px !important;
            }
            .es-m-p15 {
              padding: 15px !important;
            }
            .es-m-p15t {
              padding-top: 15px !important;
            }
            .es-m-p15b {
              padding-bottom: 15px !important;
            }
            .es-m-p15r {
              padding-right: 15px !important;
            }
            .es-m-p15l {
              padding-left: 15px !important;
            }
            .es-m-p20 {
              padding: 20px !important;
            }
            .es-m-p20t {
              padding-top: 20px !important;
            }
            .es-m-p20r {
              padding-right: 20px !important;
            }
            .es-m-p20l {
              padding-left: 20px !important;
            }
            .es-m-p25 {
              padding: 25px !important;
            }
            .es-m-p25t {
              padding-top: 25px !important;
            }
            .es-m-p25b {
              padding-bottom: 25px !important;
            }
            .es-m-p25r {
              padding-right: 25px !important;
            }
            .es-m-p25l {
              padding-left: 25px !important;
            }
            .es-m-p30 {
              padding: 30px !important;
            }
            .es-m-p30t {
              padding-top: 30px !important;
            }
            .es-m-p30b {
              padding-bottom: 30px !important;
            }
            .es-m-p30r {
              padding-right: 30px !important;
            }
            .es-m-p30l {
              padding-left: 30px !important;
            }
            .es-m-p35 {
              padding: 35px !important;
            }
            .es-m-p35t {
              padding-top: 35px !important;
            }
            .es-m-p35b {
              padding-bottom: 35px !important;
            }
            .es-m-p35r {
              padding-right: 35px !important;
            }
            .es-m-p35l {
              padding-left: 35px !important;
            }
            .es-m-p40 {
              padding: 40px !important;
            }
            .es-m-p40t {
              padding-top: 40px !important;
            }
            .es-m-p40b {
              padding-bottom: 40px !important;
            }
            .es-m-p40r {
              padding-right: 40px !important;
            }
            .es-m-p40l {
              padding-left: 40px !important;
            }
            .es-desk-hidden {
              display: table-row !important;
              width: auto !important;
              overflow: visible !important;
              max-height: inherit !important;
            }
          }
          @media screen and (max-width: 384px) {
            .mail-message-content {
              width: 414px !important;
            }
          }
        </style>
      </head>
      <body
        style="
          width: 100%;
          font-family: helvetica, 'helvetica neue', arial, verdana, sans-serif;
          -webkit-text-size-adjust: 100%;
          -ms-text-size-adjust: 100%;
          padding: 0;
          margin: 0;
        "
      >
        <div
          dir="ltr"
          class="es-wrapper-color"
          lang="en"
          style="background-color: #fafafa"
        >
          <!--[if gte mso 9
            ]><v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="t">
              <v:fill type="tile" color="#fafafa"></v:fill> </v:background
          ><![endif]-->
          <table
            class="es-wrapper"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            role="none"
            style="
              mso-table-lspace: 0pt;
              mso-table-rspace: 0pt;
              border-collapse: collapse;
              border-spacing: 0px;
              padding: 0;
              margin: 0;
              width: 100%;
              height: 100%;
              background-repeat: repeat;
              background-position: center top;
              background-color: #fafafa;
            "
          >
            <tr>
              <td valign="top" style="padding: 0; margin: 0">
                <table
                  cellpadding="0"
                  cellspacing="0"
                  class="es-header"
                  align="center"
                  role="none"
                  style="
                    mso-table-lspace: 0pt;
                    mso-table-rspace: 0pt;
                    border-collapse: collapse;
                    border-spacing: 0px;
                    table-layout: fixed !important;
                    width: 100%;
                    background-color: transparent;
                    background-repeat: repeat;
                    background-position: center top;
                  "
                >
                  <tr>
                    <td align="center" style="padding: 0; margin: 0">
                      <table
                        class="es-header-body"
                        align="center"
                        cellpadding="0"
                        cellspacing="0"
                        style="
                          mso-table-lspace: 0pt;
                          mso-table-rspace: 0pt;
                          border-collapse: collapse;
                          border-spacing: 0px;
                          background-color: #ffffff;
                          width: 400px;
                          border-width: 1px;
                          border-color: transparent;
                          border-style: solid;
                        "
                        bgcolor="#ffffff"
                        role="none"
                      >
                        <tr>
                          <td
                            align="left"
                            style="
                              margin: 0;
                              padding-right: 20px;
                              padding-top: 25px;
                              padding-bottom: 25px;
                              padding-left: 25px;
                              background-color: #e6feeb;
                              border-radius: 0px 0px 90px;
                            "
                            bgcolor="#e6feeb"
                          >
                            <table
                              cellpadding="0"
                              cellspacing="0"
                              width="100%"
                              role="none"
                              style="
                                mso-table-lspace: 0pt;
                                mso-table-rspace: 0pt;
                                border-collapse: collapse;
                                border-spacing: 0px;
                              "
                            >
                              <tr>
                                <td
                                  class="es-m-p0r"
                                  valign="top"
                                  align="center"
                                  style="padding: 0; margin: 0; width: 353px"
                                >
                                  <table
                                    cellpadding="0"
                                    cellspacing="0"
                                    width="100%"
                                    role="presentation"
                                    style="
                                      mso-table-lspace: 0pt;
                                      mso-table-rspace: 0pt;
                                      border-collapse: collapse;
                                      border-spacing: 0px;
                                    "
                                  >
                                    <tr>
                                      <td
                                        align="center"
                                        style="
                                          padding: 0;
                                          margin: 0;
                                          padding-top: 10px;
                                          padding-bottom: 15px;
                                          font-size: 0px;
                                        "
                                      >
                                        <img
                                          src="https://lvdqpp.stripocdn.email/content/guids/CABINET_debe0faeba31da11e7961e39dbd43503/images/carroticon_tDC.png"
                                          alt
                                          style="
                                            display: block;
                                            border: 0;
                                            outline: none;
                                            text-decoration: none;
                                            -ms-interpolation-mode: bicubic;
                                          "
                                          width="60"
                                        />
                                      </td>
                                    </tr>
                                    <tr>
                                      <td
                                        align="center"
                                        style="
                                          margin: 0;
                                          padding-left: 5px;
                                          padding-right: 5px;
                                          padding-top: 30px;
                                          padding-bottom: 30px;
                                        "
                                      >
                                        <h3
                                          style="
                                            margin: 0;
                                            line-height: 20px;
                                            mso-line-height-rule: exactly;
                                            font-family: lato, 'helvetica neue',
                                              helvetica, arial, sans-serif;
                                            font-size: 24px;
                                            font-style: normal;
                                            font-weight: bold;
                                            color: #020202;
                                          "
                                        >
                                          Thank you for your payment.
                                        </h3>
                                      </td>
                                    </tr>
                                    <tr>
                                      <td align="center" class="esd-block-text">
                                        <p
                                          style="
                                            margin: 0;
                                            line-height: 12px;
                                            mso-line-height-rule: exactly;
                                            font-family: lato, 'helvetica neue',
                                              helvetica, arial, sans-serif;
                                            font-size: 12px;
                                            font-style: normal;
                                            font-weight: bold;
                                            color: #5c5c5c;
                                          "
                                        >
                                          ${date}
                                        </p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
                <table
                  cellpadding="0"
                  cellspacing="0"
                  class="es-content"
                  align="center"
                  role="none"
                  style="
                    mso-table-lspace: 0pt;
                    mso-table-rspace: 0pt;
                    border-collapse: collapse;
                    border-spacing: 0px;
                    table-layout: fixed !important;
                    width: 100%;
                  "
                >
                  <tr>
                    <td align="center" style="padding: 0; margin: 0">
                      <table
                        class="es-content-body"
                        align="center"
                        cellpadding="0"
                        cellspacing="0"
                        style="
                          mso-table-lspace: 0pt;
                          mso-table-rspace: 0pt;
                          border-collapse: collapse;
                          border-spacing: 0px;
                          background-color: #ffffff;
                          width: 400px;
                          border-width: 10px;
                          border-color: transparent;
                          border-style: solid;
                        "
                        bgcolor="#ffffff"
                        role="none"
                      >
                        <tr>
                          <td
                            align="left"
                            style="
                              padding: 0;
                              margin: 0;
                              padding-bottom: 25px;
                              padding-top: 40px;
                            "
                          >
                            <!--[if mso]><table style="width:380px" cellpadding="0" cellspacing="0"><tr><td style="width:110px" valign="top"><![endif]-->
                            <table
                              cellpadding="0"
                              cellspacing="0"
                              class="es-left"
                              align="left"
                              role="none"
                              style="
                                mso-table-lspace: 0pt;
                                mso-table-rspace: 0pt;
                                border-collapse: collapse;
                                border-spacing: 0px;
                                float: left;
                              "
                            >
                              <tr>
                                <td
                                  class="es-m-p20b"
                                  align="left"
                                  style="padding: 0; margin: 0; width: 110px"
                                >
                                  <table
                                    cellpadding="0"
                                    cellspacing="0"
                                    width="100%"
                                    role="presentation"
                                    style="
                                      mso-table-lspace: 0pt;
                                      mso-table-rspace: 0pt;
                                      border-collapse: collapse;
                                      border-spacing: 0px;
                                    "
                                  >
                                    <tr>
                                      <td
                                        align="left"
                                        style="padding: 0; margin: 0"
                                      >
                                        <p
                                          style="
                                            margin: 0;
                                            -webkit-text-size-adjust: none;
                                            -ms-text-size-adjust: none;
                                            mso-line-height-rule: exactly;
                                            font-family: lato, 'helvetica neue',
                                              helvetica, arial, sans-serif;
                                            line-height: 22.5px;
                                            color: #333333;
                                            font-size: 15px;
                                          "
                                        >
                                          <strong>Type</strong>
                                        </p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                            <!--[if mso]></td><td style="width:40px"></td><td style="width:230px" valign="top"><![endif]-->
                            <table
                              cellpadding="0"
                              cellspacing="0"
                              class="es-right"
                              align="right"
                              role="none"
                              style="
                                mso-table-lspace: 0pt;
                                mso-table-rspace: 0pt;
                                border-collapse: collapse;
                                border-spacing: 0px;
                                float: right;
                              "
                            >
                              <tr>
                                <td
                                  align="left"
                                  style="padding: 0; margin: 0; width: 230px"
                                >
                                  <table
                                    cellpadding="0"
                                    cellspacing="0"
                                    width="100%"
                                    role="presentation"
                                    style="
                                      mso-table-lspace: 0pt;
                                      mso-table-rspace: 0pt;
                                      border-collapse: collapse;
                                      border-spacing: 0px;
                                    "
                                  >
                                    <tr>
                                      <td
                                        align="right"
                                        style="padding: 0; margin: 0"
                                      >
                                        <p
                                          style="
                                            margin: 0;
                                            -webkit-text-size-adjust: none;
                                            -ms-text-size-adjust: none;
                                            mso-line-height-rule: exactly;
                                            font-family: lato, 'helvetica neue',
                                              helvetica, arial, sans-serif;
                                            line-height: 22.5px;
                                            color: #333333;
                                            font-size: 15px;
                                          "
                                        >
                                          <strong>Deposit</strong>
                                        </p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                            <!--[if mso]></td></tr></table><![endif]-->
                          </td>
                        </tr>
                        <tr>
                          <td align="left" style="padding: 0; margin: 0">
                            <table
                              cellpadding="0"
                              cellspacing="0"
                              width="100%"
                              role="none"
                              style="
                                mso-table-lspace: 0pt;
                                mso-table-rspace: 0pt;
                                border-collapse: collapse;
                                border-spacing: 0px;
                              "
                            >
                              <tr>
                                <td
                                  align="center"
                                  valign="top"
                                  style="padding: 0; margin: 0; width: 380px"
                                >
                                  <table
                                    cellpadding="0"
                                    cellspacing="0"
                                    width="100%"
                                    role="presentation"
                                    style="
                                      mso-table-lspace: 0pt;
                                      mso-table-rspace: 0pt;
                                      border-collapse: collapse;
                                      border-spacing: 0px;
                                    "
                                  >
                                    <tr>
                                      <td
                                        align="center"
                                        style="padding: 0; margin: 0; font-size: 0"
                                      >
                                        <table
                                          border="0"
                                          width="100%"
                                          height="100%"
                                          cellpadding="0"
                                          cellspacing="0"
                                          role="presentation"
                                          style="
                                            mso-table-lspace: 0pt;
                                            mso-table-rspace: 0pt;
                                            border-collapse: collapse;
                                            border-spacing: 0px;
                                          "
                                        >
                                          <tr>
                                            <td
                                              style="
                                                padding: 0;
                                                margin: 0;
                                                border-bottom: 1px solid #666666;
                                                background: unset;
                                                height: 1px;
                                                width: 100%;
                                                margin: 0px;
                                              "
                                            ></td>
                                          </tr>
                                        </table>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td
                            align="left"
                            style="
                              padding: 0;
                              margin: 0;
                              padding-top: 30px;
                              padding-bottom: 30px;
                            "
                          >
                            <!--[if mso]><table style="width:380px" cellpadding="0" cellspacing="0"><tr>
        <td style="width:88px" valign="top"><![endif]-->
                            <table
                              cellpadding="0"
                              cellspacing="0"
                              class="es-left"
                              align="left"
                              role="none"
                              style="
                                mso-table-lspace: 0pt;
                                mso-table-rspace: 0pt;
                                border-collapse: collapse;
                                border-spacing: 0px;
                                float: left;
                              "
                            >
                              <tr>
                                <td
                                  class="es-m-p20b"
                                  align="left"
                                  style="padding: 0; margin: 0; width: 88px"
                                >
                                  <table
                                    cellpadding="0"
                                    cellspacing="0"
                                    width="100%"
                                    role="presentation"
                                    style="
                                      mso-table-lspace: 0pt;
                                      mso-table-rspace: 0pt;
                                      border-collapse: collapse;
                                      border-spacing: 0px;
                                    "
                                  >
                                    <tr>
                                      <td
                                        align="left"
                                        style="padding: 0; margin: 0"
                                      >
                                        <p
                                          style="
                                            margin: 0;
                                            -webkit-text-size-adjust: none;
                                            -ms-text-size-adjust: none;
                                            mso-line-height-rule: exactly;
                                            font-family: lato, 'helvetica neue',
                                              helvetica, arial, sans-serif;
                                            line-height: 22.5px;
                                            color: #333333;
                                            font-size: 15px;
                                          "
                                        >
                                          <strong>Ref./S. ID</strong>
                                        </p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                            <!--[if mso]></td><td style="width:40px"></td>
        <td style="width:252px" valign="top"><![endif]-->
                            <table
                              cellpadding="0"
                              cellspacing="0"
                              class="es-right"
                              align="right"
                              role="none"
                              style="
                                mso-table-lspace: 0pt;
                                mso-table-rspace: 0pt;
                                border-collapse: collapse;
                                border-spacing: 0px;
                                float: right;
                              "
                            >
                              <tr>
                                <td
                                  align="left"
                                  style="padding: 0; margin: 0; width: 252px"
                                >
                                  <table
                                    cellpadding="0"
                                    cellspacing="0"
                                    width="100%"
                                    role="presentation"
                                    style="
                                      mso-table-lspace: 0pt;
                                      mso-table-rspace: 0pt;
                                      border-collapse: collapse;
                                      border-spacing: 0px;
                                    "
                                  >
                                    <tr>
                                      <td
                                        align="right"
                                        style="padding: 0; margin: 0"
                                      >
                                        <p
                                          style="
                                            margin: 0;
                                            -webkit-text-size-adjust: none;
                                            -ms-text-size-adjust: none;
                                            mso-line-height-rule: exactly;
                                            font-family: lato, 'helvetica neue',
                                              helvetica, arial, sans-serif;
                                            line-height: 22.5px;
                                            color: #333333;
                                            font-size: 15px;
                                          "
                                        >
                                          <strong>${payment_ref}</strong>
                                        </p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                            <!--[if mso]></td></tr></table><![endif]-->
                          </td>
                        </tr>
                        <tr>
                          <td align="left" style="padding: 0; margin: 0">
                            <table
                              cellpadding="0"
                              cellspacing="0"
                              width="100%"
                              role="none"
                              style="
                                mso-table-lspace: 0pt;
                                mso-table-rspace: 0pt;
                                border-collapse: collapse;
                                border-spacing: 0px;
                              "
                            >
                              <tr>
                                <td
                                  align="center"
                                  valign="top"
                                  style="padding: 0; margin: 0; width: 380px"
                                >
                                  <table
                                    cellpadding="0"
                                    cellspacing="0"
                                    width="100%"
                                    role="presentation"
                                    style="
                                      mso-table-lspace: 0pt;
                                      mso-table-rspace: 0pt;
                                      border-collapse: collapse;
                                      border-spacing: 0px;
                                    "
                                  >
                                    <tr>
                                      <td
                                        align="center"
                                        style="padding: 0; margin: 0; font-size: 0"
                                      >
                                        <table
                                          border="0"
                                          width="100%"
                                          height="100%"
                                          cellpadding="0"
                                          cellspacing="0"
                                          role="presentation"
                                          style="
                                            mso-table-lspace: 0pt;
                                            mso-table-rspace: 0pt;
                                            border-collapse: collapse;
                                            border-spacing: 0px;
                                          "
                                        >
                                          <tr>
                                            <td
                                              style="
                                                padding: 0;
                                                margin: 0;
                                                border-bottom: 1px solid #666666;
                                                background: unset;
                                                height: 1px;
                                                width: 100%;
                                                margin: 0px;
                                              "
                                            ></td>
                                          </tr>
                                        </table>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td
                            align="left"
                            style="
                              padding: 0;
                              margin: 0;
                              padding-top: 30px;
                              padding-bottom: 30px;
                            "
                          >
                            <!--[if mso]><table style="width:380px" cellpadding="0" cellspacing="0"><tr><td style="width:88px" valign="top"><![endif]-->
                            <table
                              cellpadding="0"
                              cellspacing="0"
                              class="es-left"
                              align="left"
                              role="none"
                              style="
                                mso-table-lspace: 0pt;
                                mso-table-rspace: 0pt;
                                border-collapse: collapse;
                                border-spacing: 0px;
                                float: left;
                              "
                            >
                              <tr>
                                <td
                                  class="es-m-p20b"
                                  align="left"
                                  style="padding: 0; margin: 0; width: 88px"
                                >
                                  <table
                                    cellpadding="0"
                                    cellspacing="0"
                                    width="100%"
                                    role="presentation"
                                    style="
                                      mso-table-lspace: 0pt;
                                      mso-table-rspace: 0pt;
                                      border-collapse: collapse;
                                      border-spacing: 0px;
                                    "
                                  >
                                    <tr>
                                      <td
                                        align="left"
                                        style="padding: 0; margin: 0"
                                      >
                                        <p
                                          style="
                                            margin: 0;
                                            -webkit-text-size-adjust: none;
                                            -ms-text-size-adjust: none;
                                            mso-line-height-rule: exactly;
                                            font-family: lato, 'helvetica neue',
                                              helvetica, arial, sans-serif;
                                            line-height: 22.5px;
                                            color: #333333;
                                            font-size: 15px;
                                          "
                                        >
                                          <strong>Amount</strong>
                                        </p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                            <!--[if mso]></td><td style="width:40px"></td><td style="width:252px" valign="top"><![endif]-->
                            <table
                              cellpadding="0"
                              cellspacing="0"
                              class="es-right"
                              align="right"
                              role="none"
                              style="
                                mso-table-lspace: 0pt;
                                mso-table-rspace: 0pt;
                                border-collapse: collapse;
                                border-spacing: 0px;
                                float: right;
                              "
                            >
                              <tr>
                                <td
                                  align="left"
                                  style="padding: 0; margin: 0; width: 252px"
                                >
                                  <table
                                    cellpadding="0"
                                    cellspacing="0"
                                    width="100%"
                                    role="presentation"
                                    style="
                                      mso-table-lspace: 0pt;
                                      mso-table-rspace: 0pt;
                                      border-collapse: collapse;
                                      border-spacing: 0px;
                                    "
                                  >
                                    <tr>
                                      <td
                                        align="right"
                                        style="padding: 0; margin: 0"
                                      >
                                        <p
                                          style="
                                            margin: 0;
                                            -webkit-text-size-adjust: none;
                                            -ms-text-size-adjust: none;
                                            mso-line-height-rule: exactly;
                                            font-family: lato, 'helvetica neue',
                                              helvetica, arial, sans-serif;
                                            line-height: 22.5px;
                                            color: #333333;
                                            font-size: 15px;
                                          "
                                        >
                                          <strong>${amount}</strong>
                                        </p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                            <!--[if mso]></td></tr></table><![endif]-->
                          </td>
                        </tr>
                        <tr>
                          <td align="left" style="padding: 0; margin: 0">
                            <table
                              cellpadding="0"
                              cellspacing="0"
                              width="100%"
                              role="none"
                              style="
                                mso-table-lspace: 0pt;
                                mso-table-rspace: 0pt;
                                border-collapse: collapse;
                                border-spacing: 0px;
                              "
                            >
                              <tr>
                                <td
                                  align="center"
                                  valign="top"
                                  style="padding: 0; margin: 0; width: 380px"
                                >
                                  <table
                                    cellpadding="0"
                                    cellspacing="0"
                                    width="100%"
                                    role="presentation"
                                    style="
                                      mso-table-lspace: 0pt;
                                      mso-table-rspace: 0pt;
                                      border-collapse: collapse;
                                      border-spacing: 0px;
                                    "
                                  >
                                    <tr>
                                      <td
                                        align="center"
                                        style="padding: 0; margin: 0; font-size: 0"
                                      >
                                        <table
                                          border="0"
                                          width="100%"
                                          height="100%"
                                          cellpadding="0"
                                          cellspacing="0"
                                          role="presentation"
                                          style="
                                            mso-table-lspace: 0pt;
                                            mso-table-rspace: 0pt;
                                            border-collapse: collapse;
                                            border-spacing: 0px;
                                          "
                                        >
                                          <tr>
                                            <td
                                              style="
                                                padding: 0;
                                                margin: 0;
                                                border-bottom: 1px solid #666666;
                                                background: unset;
                                                height: 1px;
                                                width: 100%;
                                                margin: 0px;
                                              "
                                            ></td>
                                          </tr>
                                        </table>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td
                            align="left"
                            style="
                              padding: 0;
                              margin: 0;
                              padding-top: 30px;
                              padding-bottom: 30px;
                            "
                          >
                            <!--[if mso]><table style="width:380px" cellpadding="0" cellspacing="0"><tr><td style="width:88px" valign="top"><![endif]-->
                            <table
                              cellpadding="0"
                              cellspacing="0"
                              class="es-left"
                              align="left"
                              role="none"
                              style="
                                mso-table-lspace: 0pt;
                                mso-table-rspace: 0pt;
                                border-collapse: collapse;
                                border-spacing: 0px;
                                float: left;
                              "
                            >
                              <tr>
                                <td
                                  class="es-m-p20b"
                                  align="left"
                                  style="padding: 0; margin: 0; width: 88px"
                                >
                                  <table
                                    cellpadding="0"
                                    cellspacing="0"
                                    width="100%"
                                    role="presentation"
                                    style="
                                      mso-table-lspace: 0pt;
                                      mso-table-rspace: 0pt;
                                      border-collapse: collapse;
                                      border-spacing: 0px;
                                    "
                                  >
                                    <tr>
                                      <td
                                        align="left"
                                        style="padding: 0; margin: 0"
                                      >
                                        <p
                                          style="
                                            margin: 0;
                                            -webkit-text-size-adjust: none;
                                            -ms-text-size-adjust: none;
                                            mso-line-height-rule: exactly;
                                            font-family: lato, 'helvetica neue',
                                              helvetica, arial, sans-serif;
                                            line-height: 22.5px;
                                            color: #333333;
                                            font-size: 15px;
                                          "
                                        >
                                          <b>Beneficiary name</b>
                                        </p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                            <!--[if mso]></td><td style="width:40px"></td><td style="width:252px" valign="top"><![endif]-->
                            <table
                              cellpadding="0"
                              cellspacing="0"
                              class="es-right"
                              align="right"
                              role="none"
                              style="
                                mso-table-lspace: 0pt;
                                mso-table-rspace: 0pt;
                                border-collapse: collapse;
                                border-spacing: 0px;
                                float: right;
                              "
                            >
                              <tr>
                                <td
                                  align="left"
                                  style="padding: 0; margin: 0; width: 252px"
                                >
                                  <table
                                    cellpadding="0"
                                    cellspacing="0"
                                    width="100%"
                                    role="presentation"
                                    style="
                                      mso-table-lspace: 0pt;
                                      mso-table-rspace: 0pt;
                                      border-collapse: collapse;
                                      border-spacing: 0px;
                                    "
                                  >
                                    <tr>
                                      <td
                                        align="right"
                                        style="padding: 0; margin: 0"
                                      >
                                        <p
                                          style="
                                            margin: 0;
                                            -webkit-text-size-adjust: none;
                                            -ms-text-size-adjust: none;
                                            mso-line-height-rule: exactly;
                                            font-family: lato, 'helvetica neue',
                                              helvetica, arial, sans-serif;
                                            line-height: 22.5px;
                                            color: #333333;
                                            font-size: 15px;
                                          "
                                        >
                                          <strong
                                            >${misc.account_name || ""}</strong
                                          >
                                        </p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                            <!--[if mso]></td></tr></table><![endif]-->
                          </td>
                        </tr>
                        <tr>
                          <td align="left" style="padding: 0; margin: 0">
                            <table
                              cellpadding="0"
                              cellspacing="0"
                              width="100%"
                              role="none"
                              style="
                                mso-table-lspace: 0pt;
                                mso-table-rspace: 0pt;
                                border-collapse: collapse;
                                border-spacing: 0px;
                              "
                            >
                              <tr>
                                <td
                                  align="center"
                                  valign="top"
                                  style="padding: 0; margin: 0; width: 380px"
                                >
                                  <table
                                    cellpadding="0"
                                    cellspacing="0"
                                    width="100%"
                                    role="presentation"
                                    style="
                                      mso-table-lspace: 0pt;
                                      mso-table-rspace: 0pt;
                                      border-collapse: collapse;
                                      border-spacing: 0px;
                                    "
                                  >
                                    <tr>
                                      <td
                                        align="center"
                                        style="padding: 0; margin: 0; font-size: 0"
                                      >
                                        <table
                                          border="0"
                                          width="100%"
                                          height="100%"
                                          cellpadding="0"
                                          cellspacing="0"
                                          role="presentation"
                                          style="
                                            mso-table-lspace: 0pt;
                                            mso-table-rspace: 0pt;
                                            border-collapse: collapse;
                                            border-spacing: 0px;
                                          "
                                        >
                                          <tr>
                                            <td
                                              style="
                                                padding: 0;
                                                margin: 0;
                                                border-bottom: 1px solid #666666;
                                                background: unset;
                                                height: 1px;
                                                width: 100%;
                                                margin: 0px;
                                              "
                                            ></td>
                                          </tr>
                                        </table>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td
                            align="left"
                            style="
                              padding: 0;
                              margin: 0;
                              padding-top: 30px;
                              padding-bottom: 30px;
                            "
                          >
                            <!--[if mso]><table style="width:380px" cellpadding="0" cellspacing="0"><tr><td style="width:88px" valign="top"><![endif]-->
                            <table
                              cellpadding="0"
                              cellspacing="0"
                              class="es-left"
                              align="left"
                              role="none"
                              style="
                                mso-table-lspace: 0pt;
                                mso-table-rspace: 0pt;
                                border-collapse: collapse;
                                border-spacing: 0px;
                                float: left;
                              "
                            >
                              <tr>
                                <td
                                  class="es-m-p20b"
                                  align="left"
                                  style="padding: 0; margin: 0; width: 88px"
                                >
                                  <table
                                    cellpadding="0"
                                    cellspacing="0"
                                    width="100%"
                                    role="presentation"
                                    style="
                                      mso-table-lspace: 0pt;
                                      mso-table-rspace: 0pt;
                                      border-collapse: collapse;
                                      border-spacing: 0px;
                                    "
                                  >
                                    <tr>
                                      <td
                                        align="left"
                                        style="padding: 0; margin: 0"
                                      >
                                        <p
                                          style="
                                            margin: 0;
                                            -webkit-text-size-adjust: none;
                                            -ms-text-size-adjust: none;
                                            mso-line-height-rule: exactly;
                                            font-family: lato, 'helvetica neue',
                                              helvetica, arial, sans-serif;
                                            line-height: 22.5px;
                                            color: #333333;
                                            font-size: 15px;
                                          "
                                        >
                                          <b>Beneficiary account</b>
                                        </p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                            <!--[if mso]></td><td style="width:40px"></td><td style="width:252px" valign="top"><![endif]-->
                            <table
                              cellpadding="0"
                              cellspacing="0"
                              class="es-right"
                              align="right"
                              role="none"
                              style="
                                mso-table-lspace: 0pt;
                                mso-table-rspace: 0pt;
                                border-collapse: collapse;
                                border-spacing: 0px;
                                float: right;
                              "
                            >
                              <tr>
                                <td
                                  align="left"
                                  style="padding: 0; margin: 0; width: 252px"
                                >
                                  <table
                                    cellpadding="0"
                                    cellspacing="0"
                                    width="100%"
                                    role="presentation"
                                    style="
                                      mso-table-lspace: 0pt;
                                      mso-table-rspace: 0pt;
                                      border-collapse: collapse;
                                      border-spacing: 0px;
                                    "
                                  >
                                    <tr>
                                      <td
                                        align="right"
                                        style="padding: 0; margin: 0"
                                      >
                                        <p
                                          style="
                                            margin: 0;
                                            -webkit-text-size-adjust: none;
                                            -ms-text-size-adjust: none;
                                            mso-line-height-rule: exactly;
                                            font-family: lato, 'helvetica neue',
                                              helvetica, arial, sans-serif;
                                            line-height: 22.5px;
                                            color: #333333;
                                            font-size: 15px;
                                          "
                                        >
                                          <b>${misc.account_number || ""}</b>
                                        </p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                            <!--[if mso]></td></tr></table><![endif]-->
                          </td>
                        </tr>
                        <tr>
                          <td align="left" style="padding: 0; margin: 0">
                            <table
                              cellpadding="0"
                              cellspacing="0"
                              width="100%"
                              role="none"
                              style="
                                mso-table-lspace: 0pt;
                                mso-table-rspace: 0pt;
                                border-collapse: collapse;
                                border-spacing: 0px;
                              "
                            >
                              <tr>
                                <td
                                  align="center"
                                  valign="top"
                                  style="padding: 0; margin: 0; width: 380px"
                                >
                                  <table
                                    cellpadding="0"
                                    cellspacing="0"
                                    width="100%"
                                    role="presentation"
                                    style="
                                      mso-table-lspace: 0pt;
                                      mso-table-rspace: 0pt;
                                      border-collapse: collapse;
                                      border-spacing: 0px;
                                    "
                                  >
                                    <tr>
                                      <td
                                        align="center"
                                        style="padding: 0; margin: 0; font-size: 0"
                                      >
                                        <table
                                          border="0"
                                          width="100%"
                                          height="100%"
                                          cellpadding="0"
                                          cellspacing="0"
                                          role="presentation"
                                          style="
                                            mso-table-lspace: 0pt;
                                            mso-table-rspace: 0pt;
                                            border-collapse: collapse;
                                            border-spacing: 0px;
                                          "
                                        >
                                          <tr>
                                            <td
                                              style="
                                                padding: 0;
                                                margin: 0;
                                                border-bottom: 1px solid #666666;
                                                background: unset;
                                                height: 1px;
                                                width: 100%;
                                                margin: 0px;
                                              "
                                            ></td>
                                          </tr>
                                        </table>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td
                            align="left"
                            style="
                              padding: 0;
                              margin: 0;
                              padding-top: 30px;
                              padding-bottom: 30px;
                            "
                          >
                            <!--[if mso]><table style="width:380px" cellpadding="0" cellspacing="0"><tr><td style="width:88px" valign="top"><![endif]-->
                            <table
                              cellpadding="0"
                              cellspacing="0"
                              class="es-left"
                              align="left"
                              role="none"
                              style="
                                mso-table-lspace: 0pt;
                                mso-table-rspace: 0pt;
                                border-collapse: collapse;
                                border-spacing: 0px;
                                float: left;
                              "
                            >
                              <tr>
                                <td
                                  class="es-m-p20b"
                                  align="left"
                                  style="padding: 0; margin: 0; width: 88px"
                                >
                                  <table
                                    cellpadding="0"
                                    cellspacing="0"
                                    width="100%"
                                    role="presentation"
                                    style="
                                      mso-table-lspace: 0pt;
                                      mso-table-rspace: 0pt;
                                      border-collapse: collapse;
                                      border-spacing: 0px;
                                    "
                                  >
                                    <tr>
                                      <td
                                        align="left"
                                        style="padding: 0; margin: 0"
                                      >
                                        <p
                                          style="
                                            margin: 0;
                                            -webkit-text-size-adjust: none;
                                            -ms-text-size-adjust: none;
                                            mso-line-height-rule: exactly;
                                            font-family: lato, 'helvetica neue',
                                              helvetica, arial, sans-serif;
                                            line-height: 22.5px;
                                            color: #333333;
                                            font-size: 15px;
                                          "
                                        >
                                          <b>Sender name</b>
                                        </p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                            <!--[if mso]></td><td style="width:40px"></td><td style="width:252px" valign="top"><![endif]-->
                            <table
                              cellpadding="0"
                              cellspacing="0"
                              class="es-right"
                              align="right"
                              role="none"
                              style="
                                mso-table-lspace: 0pt;
                                mso-table-rspace: 0pt;
                                border-collapse: collapse;
                                border-spacing: 0px;
                                float: right;
                              "
                            >
                              <tr>
                                <td
                                  align="left"
                                  style="padding: 0; margin: 0; width: 252px"
                                >
                                  <table
                                    cellpadding="0"
                                    cellspacing="0"
                                    width="100%"
                                    role="presentation"
                                    style="
                                      mso-table-lspace: 0pt;
                                      mso-table-rspace: 0pt;
                                      border-collapse: collapse;
                                      border-spacing: 0px;
                                    "
                                  >
                                    <tr>
                                      <td
                                        align="right"
                                        style="padding: 0; margin: 0"
                                      >
                                        <p
                                          style="
                                            margin: 0;
                                            -webkit-text-size-adjust: none;
                                            -ms-text-size-adjust: none;
                                            mso-line-height-rule: exactly;
                                            font-family: lato, 'helvetica neue',
                                              helvetica, arial, sans-serif;
                                            line-height: 22.5px;
                                            color: #333333;
                                            font-size: 15px;
                                          "
                                        >
                                          <b>${misc.sender_name || ""}</b>
                                        </p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                            <!--[if mso]></td></tr></table><![endif]-->
                          </td>
                        </tr>
                        <tr>
                          <td align="left" style="padding: 0; margin: 0">
                            <table
                              cellpadding="0"
                              cellspacing="0"
                              width="100%"
                              role="none"
                              style="
                                mso-table-lspace: 0pt;
                                mso-table-rspace: 0pt;
                                border-collapse: collapse;
                                border-spacing: 0px;
                              "
                            >
                              <tr>
                                <td
                                  align="center"
                                  valign="top"
                                  style="padding: 0; margin: 0; width: 380px"
                                >
                                  <table
                                    cellpadding="0"
                                    cellspacing="0"
                                    width="100%"
                                    role="presentation"
                                    style="
                                      mso-table-lspace: 0pt;
                                      mso-table-rspace: 0pt;
                                      border-collapse: collapse;
                                      border-spacing: 0px;
                                    "
                                  >
                                    <tr>
                                      <td
                                        align="center"
                                        style="padding: 0; margin: 0; font-size: 0"
                                      >
                                        <table
                                          border="0"
                                          width="100%"
                                          height="100%"
                                          cellpadding="0"
                                          cellspacing="0"
                                          role="presentation"
                                          style="
                                            mso-table-lspace: 0pt;
                                            mso-table-rspace: 0pt;
                                            border-collapse: collapse;
                                            border-spacing: 0px;
                                          "
                                        >
                                          <tr>
                                            <td
                                              style="
                                                padding: 0;
                                                margin: 0;
                                                border-bottom: 1px solid #666666;
                                                background: unset;
                                                height: 1px;
                                                width: 100%;
                                                margin: 0px;
                                              "
                                            ></td>
                                          </tr>
                                        </table>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td
                            align="left"
                            style="
                              padding: 0;
                              margin: 0;
                              padding-top: 30px;
                              padding-bottom: 30px;
                            "
                          >
                            <!--[if mso]><table style="width:380px" cellpadding="0" cellspacing="0"><tr><td style="width:88px" valign="top"><![endif]-->
                            <table
                              cellpadding="0"
                              cellspacing="0"
                              class="es-left"
                              align="left"
                              role="none"
                              style="
                                mso-table-lspace: 0pt;
                                mso-table-rspace: 0pt;
                                border-collapse: collapse;
                                border-spacing: 0px;
                                float: left;
                              "
                            >
                              <tr>
                                <td
                                  class="es-m-p20b"
                                  align="left"
                                  style="padding: 0; margin: 0; width: 88px"
                                >
                                  <table
                                    cellpadding="0"
                                    cellspacing="0"
                                    width="100%"
                                    role="presentation"
                                    style="
                                      mso-table-lspace: 0pt;
                                      mso-table-rspace: 0pt;
                                      border-collapse: collapse;
                                      border-spacing: 0px;
                                    "
                                  >
                                    <tr>
                                      <td
                                        align="left"
                                        style="padding: 0; margin: 0"
                                      >
                                        <p
                                          style="
                                            margin: 0;
                                            -webkit-text-size-adjust: none;
                                            -ms-text-size-adjust: none;
                                            mso-line-height-rule: exactly;
                                            font-family: lato, 'helvetica neue',
                                              helvetica, arial, sans-serif;
                                            line-height: 22.5px;
                                            color: #333333;
                                            font-size: 15px;
                                          "
                                        >
                                          <b>Sender account</b>
                                        </p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                            <!--[if mso]></td><td style="width:40px"></td><td style="width:252px" valign="top"><![endif]-->
                            <table
                              cellpadding="0"
                              cellspacing="0"
                              class="es-right"
                              align="right"
                              role="none"
                              style="
                                mso-table-lspace: 0pt;
                                mso-table-rspace: 0pt;
                                border-collapse: collapse;
                                border-spacing: 0px;
                                float: right;
                              "
                            >
                              <tr>
                                <td
                                  align="left"
                                  style="padding: 0; margin: 0; width: 252px"
                                >
                                  <table
                                    cellpadding="0"
                                    cellspacing="0"
                                    width="100%"
                                    role="presentation"
                                    style="
                                      mso-table-lspace: 0pt;
                                      mso-table-rspace: 0pt;
                                      border-collapse: collapse;
                                      border-spacing: 0px;
                                    "
                                  >
                                    <tr>
                                      <td
                                        align="right"
                                        style="padding: 0; margin: 0"
                                      >
                                        <p
                                          style="
                                            margin: 0;
                                            -webkit-text-size-adjust: none;
                                            -ms-text-size-adjust: none;
                                            mso-line-height-rule: exactly;
                                            font-family: lato, 'helvetica neue',
                                              helvetica, arial, sans-serif;
                                            line-height: 22.5px;
                                            color: #333333;
                                            font-size: 15px;
                                          "
                                        >
                                          <b>${misc.sender_account || ""}</b>
                                        </p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                            <!--[if mso]></td></tr></table><![endif]-->
                          </td>
                        </tr>
    
                        <tr>
                          <td align="left" style="padding: 0; margin: 0">
                            <table
                              cellpadding="0"
                              cellspacing="0"
                              width="100%"
                              role="none"
                              style="
                                mso-table-lspace: 0pt;
                                mso-table-rspace: 0pt;
                                border-collapse: collapse;
                                border-spacing: 0px;
                              "
                            >
                              <tr>
                                <td
                                  align="center"
                                  valign="top"
                                  style="padding: 0; margin: 0; width: 380px"
                                >
                                  <table
                                    cellpadding="0"
                                    cellspacing="0"
                                    width="100%"
                                    role="presentation"
                                    style="
                                      mso-table-lspace: 0pt;
                                      mso-table-rspace: 0pt;
                                      border-collapse: collapse;
                                      border-spacing: 0px;
                                    "
                                  >
                                    <tr>
                                      <td
                                        align="center"
                                        style="padding: 0; margin: 0; font-size: 0"
                                      >
                                        <table
                                          border="0"
                                          width="100%"
                                          height="100%"
                                          cellpadding="0"
                                          cellspacing="0"
                                          role="presentation"
                                          style="
                                            mso-table-lspace: 0pt;
                                            mso-table-rspace: 0pt;
                                            border-collapse: collapse;
                                            border-spacing: 0px;
                                          "
                                        >
                                          <tr>
                                            <td
                                              style="
                                                padding: 0;
                                                margin: 0;
                                                border-bottom: 1px solid #666666;
                                                background: unset;
                                                height: 1px;
                                                width: 100%;
                                                margin: 0px;
                                              "
                                            ></td>
                                          </tr>
                                        </table>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td
                            align="left"
                            style="
                              padding: 0;
                              margin: 0;
                              padding-top: 30px;
                              padding-bottom: 30px;
                            "
                          >
                            <!--[if mso]><table style="width:380px" cellpadding="0" cellspacing="0"><tr><td style="width:88px" valign="top"><![endif]-->
                            <table
                              cellpadding="0"
                              cellspacing="0"
                              class="es-left"
                              align="left"
                              role="none"
                              style="
                                mso-table-lspace: 0pt;
                                mso-table-rspace: 0pt;
                                border-collapse: collapse;
                                border-spacing: 0px;
                                float: left;
                              "
                            >
                              <tr>
                                <td
                                  class="es-m-p20b"
                                  align="left"
                                  style="padding: 0; margin: 0; width: 88px"
                                >
                                  <table
                                    cellpadding="0"
                                    cellspacing="0"
                                    width="100%"
                                    role="presentation"
                                    style="
                                      mso-table-lspace: 0pt;
                                      mso-table-rspace: 0pt;
                                      border-collapse: collapse;
                                      border-spacing: 0px;
                                    "
                                  >
                                    <tr>
                                      <td
                                        align="left"
                                        style="padding: 0; margin: 0"
                                      >
                                        <p
                                          style="
                                            margin: 0;
                                            -webkit-text-size-adjust: none;
                                            -ms-text-size-adjust: none;
                                            mso-line-height-rule: exactly;
                                            font-family: lato, 'helvetica neue',
                                              helvetica, arial, sans-serif;
                                            line-height: 22.5px;
                                            color: #333333;
                                            font-size: 15px;
                                          "
                                        >
                                          <b>Status</b>
                                        </p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                            <!--[if mso]></td><td style="width:40px"></td><td style="width:252px" valign="top"><![endif]-->
                            <table
                              cellpadding="0"
                              cellspacing="0"
                              class="es-right"
                              align="right"
                              role="none"
                              style="
                                mso-table-lspace: 0pt;
                                mso-table-rspace: 0pt;
                                border-collapse: collapse;
                                border-spacing: 0px;
                                float: right;
                              "
                            >
                              <tr>
                                <td
                                  align="left"
                                  style="padding: 0; margin: 0; width: 252px"
                                >
                                  <table
                                    cellpadding="0"
                                    cellspacing="0"
                                    width="100%"
                                    role="presentation"
                                    style="
                                      mso-table-lspace: 0pt;
                                      mso-table-rspace: 0pt;
                                      border-collapse: collapse;
                                      border-spacing: 0px;
                                    "
                                  >
                                    <tr>
                                      <td
                                        align="right"
                                        style="padding: 0; margin: 0"
                                      >
                                        <p
                                          style="
                                            margin: 0;
                                            -webkit-text-size-adjust: none;
                                            -ms-text-size-adjust: none;
                                            mso-line-height-rule: exactly;
                                            font-family: lato, 'helvetica neue',
                                              helvetica, arial, sans-serif;
                                            line-height: 22.5px;
                                            color: #333333;
                                            font-size: 15px;
                                          "
                                        >
                                          <strong>${status}</strong>
                                        </p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                            <!--[if mso]></td></tr></table><![endif]-->
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
                <table
                  cellpadding="0"
                  cellspacing="0"
                  class="es-footer"
                  align="center"
                  role="none"
                  style="
                    mso-table-lspace: 0pt;
                    mso-table-rspace: 0pt;
                    border-collapse: collapse;
                    border-spacing: 0px;
                    table-layout: fixed !important;
                    width: 100%;
                    background-color: transparent;
                    background-repeat: repeat;
                    background-position: center top;
                  "
                >
                  <tr>
                    <td align="center" style="padding: 0; margin: 0">
                      <table
                        class="es-footer-body"
                        align="center"
                        cellpadding="0"
                        cellspacing="0"
                        style="
                          mso-table-lspace: 0pt;
                          mso-table-rspace: 0pt;
                          border-collapse: collapse;
                          border-spacing: 0px;
                          background-color: #ffffff;
                          width: 400px;
                        "
                        bgcolor="#ffffff"
                        role="none"
                      >
                        <tr>
                          <td
                            align="left"
                            bgcolor="#e6feeb"
                            style="
                              margin: 0;
                              padding-top: 20px;
                              padding-bottom: 20px;
                              padding-left: 20px;
                              padding-right: 20px;
                              background-color: #e6feeb;
                              border-radius: 0px 90px 0px 0px;
                            "
                          >
                            <table
                              cellpadding="0"
                              cellspacing="0"
                              width="100%"
                              role="none"
                              style="
                                mso-table-lspace: 0pt;
                                mso-table-rspace: 0pt;
                                border-collapse: collapse;
                                border-spacing: 0px;
                              "
                            >
                              <tr>
                                <td
                                  align="left"
                                  style="padding: 0; margin: 0; width: 360px"
                                >
                                  <table
                                    cellpadding="0"
                                    cellspacing="0"
                                    width="100%"
                                    role="presentation"
                                    style="
                                      mso-table-lspace: 0pt;
                                      mso-table-rspace: 0pt;
                                      border-collapse: collapse;
                                      border-spacing: 0px;
                                    "
                                  >
                                    <tr>
                                      <td
                                        align="center"
                                        style="
                                          padding: 10px;
                                          margin: 0;
                                          font-size: 0;
                                        "
                                      >
                                        <table
                                          cellpadding="0"
                                          cellspacing="0"
                                          class="es-table-not-adapt es-social"
                                          dir="ltr"
                                          role="presentation"
                                          style="
                                            mso-table-lspace: 0pt;
                                            mso-table-rspace: 0pt;
                                            border-collapse: collapse;
                                            border-spacing: 0px;
                                          "
                                        >
                                          <tr>
                                            <td
                                              align="center"
                                              valign="top"
                                              style="padding: 0; margin: 0"
                                            >
                                              <img
                                                src="https://lvdqpp.stripocdn.email/content/assets/img/messenger-icons/circle-colored/whatsapp-circle-colored.png"
                                                alt="Carrot on Whatsapp"
                                                title="WhatsApp"
                                                width="64"
                                                height="64"
                                                style="
                                                  display: block;
                                                  border: 0;
                                                  outline: none;
                                                  text-decoration: none;
                                                  -ms-interpolation-mode: bicubic;
                                                "
                                              />
                                            </td>
                                          </tr>
                                        </table>
                                      </td>
                                    </tr>
                                    <tr>
                                      <td
                                        align="center"
                                        style="
                                          margin: 0;
                                          padding-top: 10px;
                                          padding-bottom: 10px;
                                          padding-left: 40px;
                                          padding-right: 40px;
                                        "
                                      >
                                        <p
                                          style="
                                            margin: 0;
                                            -webkit-text-size-adjust: none;
                                            -ms-text-size-adjust: none;
                                            mso-line-height-rule: exactly;
                                            font-family: lato, 'helvetica neue',
                                              helvetica, arial, sans-serif;
                                            line-height: 21px;
                                            color: #131313;
                                            font-size: 14px;
                                          "
                                        >
                                          Chat<strong> +2347075750458 </strong>on
                                          <strong>WhatsApp </strong>to open a bank
                                          account.
                                        </p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td align="left" style="padding: 0; margin: 0">
                            <table
                              cellpadding="0"
                              cellspacing="0"
                              width="100%"
                              role="none"
                              style="
                                mso-table-lspace: 0pt;
                                mso-table-rspace: 0pt;
                                border-collapse: collapse;
                                border-spacing: 0px;
                              "
                            >
                              <tr>
                                <td
                                  align="left"
                                  style="padding: 0; margin: 0; width: 400px"
                                >
                                  <table
                                    cellpadding="0"
                                    cellspacing="0"
                                    width="100%"
                                    role="presentation"
                                    style="
                                      mso-table-lspace: 0pt;
                                      mso-table-rspace: 0pt;
                                      border-collapse: collapse;
                                      border-spacing: 0px;
                                    "
                                  >
                                    <tr>
                                      <td
                                        align="center"
                                        style="
                                          padding: 0;
                                          margin: 0;
                                          font-size: 0px;
                                        "
                                      >
                                        <img
                                          class="adapt-img"
                                          src="https://lvdqpp.stripocdn.email/content/guids/CABINET_debe0faeba31da11e7961e39dbd43503/images/frame_1_1.png"
                                          alt
                                          style="
                                            display: block;
                                            border: 0;
                                            outline: none;
                                            text-decoration: none;
                                            -ms-interpolation-mode: bicubic;
                                          "
                                          width="400"
                                        />
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td
                            align="left"
                            bgcolor="#e6feeb"
                            style="
                              margin: 0;
                              padding-top: 20px;
                              padding-bottom: 20px;
                              padding-left: 20px;
                              padding-right: 20px;
                              background-color: #e6feeb;
                            "
                          >
                            <table
                              cellpadding="0"
                              cellspacing="0"
                              width="100%"
                              role="none"
                              style="
                                mso-table-lspace: 0pt;
                                mso-table-rspace: 0pt;
                                border-collapse: collapse;
                                border-spacing: 0px;
                              "
                            >
                              <tr>
                                <td
                                  align="left"
                                  style="padding: 0; margin: 0; width: 360px"
                                >
                                  <table
                                    cellpadding="0"
                                    cellspacing="0"
                                    width="100%"
                                    role="presentation"
                                    style="
                                      mso-table-lspace: 0pt;
                                      mso-table-rspace: 0pt;
                                      border-collapse: collapse;
                                      border-spacing: 0px;
                                    "
                                  >
                                    <tr>
                                      <td
                                        align="center"
                                        style="padding: 10px; margin: 0"
                                      >
                                        <p
                                          style="
                                            margin: 0;
                                            -webkit-text-size-adjust: none;
                                            -ms-text-size-adjust: none;
                                            mso-line-height-rule: exactly;
                                            font-family: lato, 'helvetica neue',
                                              helvetica, arial, sans-serif;
                                            line-height: 18px;
                                            color: #333333;
                                            font-size: 12px;
                                          "
                                        >
                                          <strong>© Carrot Monie 2024.</strong>
                                        </p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>
      </body>
    </html>
    `;

    const pdfBuffer = await generatePdfFromHtml(htmlContent, browser);

    const Key = `${payment_ref}.pdf`;

    // Upload to S3
    const params = {
      Bucket: S3_BUCKET,
      Key, // File name in S3
      Body: pdfBuffer, // The PDF content
      ContentType: "application/pdf", // Set the content type
      ACL: "public-read", // Set the file permissions (optional)
    };

    const uploadResult = {
      Location: `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${Key}`,
    };

    await s3.send(new PutObjectCommand(params));

    //Send to WhatsApp
    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v23.0/${WA_PHONE_NUMBER_ID}/messages`,
      headers: {
        Authorization: `Bearer ${GRAPH_API_TOKEN}`,
      },
      data: {
        messaging_product: "whatsapp",
        to: user.mobile,
        type: "template",
        template: {
          name: "carrot_receipt",
          language: {
            code: "en",
          },
          components: [
            {
              type: "header",
              parameters: [
                {
                  type: "document",
                  document: {
                    link: uploadResult.Location,
                    filename: Key,
                  },
                },
              ],
            },
          ],
        },
      },
    });

    console.log("PDF uploaded successfully:", uploadResult.Location);
  } catch (error) {
    console.error("Deposit template error", error);
  }
}
