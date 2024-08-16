import AWS from "aws-sdk";

const ses = new AWS.SES({ region: "eu-west-1" });

async function sendMail(event) {
  const record = event.Records[0];
  console.log(record);

  const { subject, recipient, body } = JSON.parse(record.body);

  const params = {
    Source: "melvin.vermeer@gmail.com",
    Destination: { ToAddresses: [recipient] },
    Message: {
      Body: {
        Text: {
          Data: body,
        },
      },
      Subject: {
        Data: subject,
      },
    },
  };

  try {
    const result = await ses.sendEmail(params).promise();
    return result;
  } catch (error) {
    console.log(error);
    return error;
  }
}

export const handler = sendMail;
