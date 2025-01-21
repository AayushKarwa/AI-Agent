import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';

import { GoogleGenerativeAI } from '@google/generative-ai';

type aiResponseType = {
    function: Function,
    parameters: [string]
}


const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || ''); 

const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });


async function getWeatherDetails(city: string = '') {
    
    const result = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${process.env.WEATHER_API_KEY}`);
    // console.log(result)
    const tempInKelvin = result.data.main.temp;
    const tempInCelsius = tempInKelvin - 273;

    return tempInCelsius.toFixed(2);
    
}


const tools: Record<string, Function> = {
    getWeatherDetails,
};


async function agent(input: string) {
    try {
        
        const systemPrompt = `
You are an assistant that maps user questions to available functions and returns their results. 
Available functions:
1. getWeatherDetails(city: string): string - Returns weather information for a given city.

Given the user query, determine which function to call and with what parameters. Return the function name and parameters as JSON.
If the question cannot be mapped to a function, respond with "unsupported query".
`;


        const response = await model.generateContent(
            `${systemPrompt}\nUser Query: "${input}"`
        );

        let aiResponse = response.response.text();
        console.log('LLM Response:', aiResponse);

       
        aiResponse = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();

        
        let functionCall;
        try {
            functionCall = JSON.parse(aiResponse); 
        } catch (error) {
            console.error('Error parsing LLM response:', error);
            return "Sorry, I couldn't understand your request.";
        }

        if (functionCall.function && tools[functionCall.function]) {
            const funk = tools[functionCall.function];
            console.log(tools)
            const result = await funk(...Object.values(functionCall.parameters || {}));
            const city = await functionCall.parameters|| '';
            console.log(city)
            const response = await model.generateContent(
                `The temperature in ${city.city} is ${result}°C. give an exact same format response in one sentence.`
            );
    
            let aiResponse = response.response.text();
            console.log('LLM Response:', response.response.text());

            return `Result: ${aiResponse}`;
        }

        return "Sorry, I couldn't map your query to a known function.";
    } catch (error) {
        console.error('Error in agent:', error);
        return 'An error occurred while processing your request.';
    }
}


(async () => {
    const userQuery = 'what is temperature in jalna ?';
    const result = await agent(userQuery);
    console.log(result); 
})();
