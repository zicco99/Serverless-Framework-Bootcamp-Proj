async function hello(event, context) {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'It works :)' }),
  };
}

export const handler = hello;


