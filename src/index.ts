import dotenv from "dotenv";
dotenv.config();
import axios from "axios";
import readlineSync from "readline-sync";
import Together from "together-ai";

const client = new Together({
  apiKey: process.env.TOGETHER_API_KEY || "",
});

// TOOLS
async function getWeatherDetails(city: string = ""): Promise<string> {
  try {
    const result = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${process.env.WEATHER_API_KEY}`
    );

    const tempInKelvin = result.data.main.temp;
    const tempInCelsius = tempInKelvin - 273.15; 
    console.log(result.data.main)
    return `${tempInCelsius.toFixed(2)}°C`;
  } catch (error) {
    throw new Error(
      `Failed to fetch weather details for "${city}": ${error}`
    );
  }
}


const tools: { [key: string]: (input: string) => Promise<string> } = {
  getWeatherDetails,
};

// SYSTEM PROMPT
const SYSTEM_PROMPT = `You are an AI Assistant with START, PLAN, ACTION, Observation, and Output State.
Wait for the user prompt and first PLAN using available tools.
After Planning, take the action with appropriate tools and wait for Observation based on Action.
Once you get the observations, return the AI response based on START prompt and observations.
strictly follow json output format.

Available Tools:

-getWeatherDetails(city:string):string
getWeatherDetails is a function that accepts city name and returns weather details.

EXAMPLE:

{ "type": "user", "user": "What is the sum of weather of Patiala and Mohali?" }
{ "type": "plan", "plan": "I will call the getWeatherDetails for Patiala" }
{ "type": "action", "function": "getWeatherDetails", "input": "patiala" }
{ "type": "observation", "observation": "10°C" }
{ "type": "plan", "plan": "I will call getWeatherDetails for Mohali" }
{ "type": "action", "function": "getWeatherDetails", "input": "mohali" }
{ "type": "observation", "observation": "15°C" }
{ "type": "output", "output": "The sum of the weather of Patiala and Mohali is 25°C" }
`;


let messages: { role: "system" | "user" | "assistant" | "tool"; content: string }[] =
  [];
messages.push({ role: "system", content: SYSTEM_PROMPT });


type ToolCall =
  | {
      type: "action";
      function: keyof typeof tools;
      input: string;
    }
  | {
      type: "output";
      output: string;
    }
  | {
      type: "observation";
      observation: string;
    };

(async () => {
  while (true) {
    const query = readlineSync.question(">> ");
    const userMessage = { type: "user", user: query };
    messages.push({ role: "user", content: JSON.stringify(userMessage) });

    while (true) {
      try {
        
        const chat = await client.chat.completions.create({
          model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
          messages: messages,
          response_format: { type: "json_object" },
        });

        const result = chat.choices[0]?.message?.content;
        console.log(result)
        if (!result) {
          console.error("No response received from LLM.");
          break;
        }

        messages.push({ role: "assistant", content: result });

        const call = JSON.parse(result) as ToolCall;

        
        if (call.type === "output") {
          console.log(`LLM: ${call.output}`);
          break;
        }

      
        if (call.type === "action") {
          const toolFn = tools[call.function];
          console.log(toolFn)
          if (toolFn) {
            const observation = await toolFn(call.input);
            const observationMessage = {
              type: "observation",
              observation,
            };
            messages.push({
              role: "assistant",
              content: JSON.stringify(observationMessage),
            });
            console.log(`Observation: ${observation}`);
          } else {
            console.error(`Tool "${call.function}" not found.`);
            break;
          }
        }
      } catch (error) {
        console.error("Error:", (error as Error).message);
        break;
      }
    }
  }
})();
