import { generateImageFromHtml } from "./index.js";

export async function GenerateStat({ browser, money_in, money_out }) {
  let long_str = false;
  if (money_in.length > 12 || money_out.length > 12) long_str = true;

  try {
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Income & Expense</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap"
          rel="stylesheet"
        />
        <style>
          body {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            width: 100vw;
            margin: 0;
            background-color: transparent;
            font-family: "Inter", sans-serif;
          }
    
          .container {
            display: flex;
            align-items: center;
            background-color: #1e1e1e;
            color: white;
            padding: 20px 30px;
            border-radius: 16px;
            width: 500px;
            box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.2);
            position: relative;
            overflow: hidden;
          }
    
          .section {
            display: flex;
            align-items: center;
            flex: 1;
            gap: 16px;
          }
    
          .income {
                justify-content: flex-start;
            }
    
            .expense {
                justify-content: flex-end;
            }
    
          .icon {
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
    
          .income .icon svg {
          }
    
          .expense .icon svg {
          }
    
          .text {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
    
          .label {
            font-size: 20px;
            color: #bdbdbd;
            font-weight: 600;
            margin: 0;
          }
    
          .amount {
            font-size: ${long_str ? "18px" : "24px"};
            font-weight: 600;
            margin: 0;
          }
    
          .divider {
            width: 2px;
            height: 40px;
            background-color: rgba(255, 255, 255, 0.2);
          }
    
          /* Semi-Circle Decorative Elements */
          .semi-circle {
            position: absolute;
            width: 65px;
            height: 65px;
            background-color: #326AFD;
            border-radius: 100px 100px 0 0;
            transform: rotate(135deg);
            top: -40px;
            left: -40px;
          }
    
          .semi-circle.right {
            background-color: #f2d1b3;
            top: auto;
            bottom: -40px;
            left: auto;
            right: -40px;
            transform: rotate(-45deg);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="semi-circle"></div>
          <!-- Top Left Semi-Circle -->
    
          <!-- Total Income Section -->
          <div class="section income">
            <div class="icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 14L12 22M12 22L20 14M12 22L12 2"
                  stroke="#53D258"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
            <div class="text">
              <p class="label">Money In</p>
              <p class="amount">₦${money_in}</p>
            </div>
          </div>
    
          <div class="divider"></div>
    
          <!-- Total Expense Section -->
          <div class="section expense">
            <div class="icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M20 10L12 2M12 2L4 10M12 2L12 22"
                  stroke="#FFCC00"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
            <div class="text">
              <p class="label">Money Out</p>
              <p class="amount">₦${money_out}</p>
            </div>
          </div>
    
          <div class="semi-circle right"></div>
          <!-- Bottom Right Semi-Circle -->
        </div>
      </body>
    </html>
    `;

    const imageBuffer = await generateImageFromHtml(
      browser,
      htmlContent,
      ".container"
    );

    return imageBuffer;
  } catch (error) {
    console.error("Stat template error");
  }
}
