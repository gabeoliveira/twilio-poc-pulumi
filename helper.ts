const twilio = require('twilio');
require('dotenv').config();


const { 
    TWILIO_ACCOUNT_SID, 
    TWILIO_AUTH_TOKEN, 
    TWILIO_USERNAME, 
    TWILIO_PASSWORD 
} = process.env;


const client = TWILIO_USERNAME ? 
        twilio(TWILIO_USERNAME, TWILIO_PASSWORD, { accountSid: TWILIO_ACCOUNT_SID }) : 
        twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);




module.exports.getTaskChannel = async (channelType, workspaceSid) => {
    return client.taskrouter.workspaces(workspaceSid)
        .taskChannels
        .list({limit: 20})
        .then(taskChannels => taskChannels.find(channel => channel.uniqueName === channelType));

    
}
