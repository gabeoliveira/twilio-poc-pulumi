
const pulumi = require("@pulumi/pulumi");
require('dotenv').config();

const { Resource, Serverless, CheckServerless, FlexPlugin } = require('twilio-pulumi-provider');
const { getTaskChannel } = require('./helper.ts'); 



const stack = pulumi.getStack();


/*Initial Setup*/


/* TaskRouter Setup */

const flexWorkspace = new Resource("flex-workspace", {
    resource: ["taskrouter", "workspaces"],
    attributes: {
        friendlyName: 'Flex Task Assignment'
    }
});

const supportTaskQueue = new Resource("support-taskQueue", {
    resource: ["taskrouter", { "workspaces" : flexWorkspace.sid }, "taskQueues"],
    attributes: {
        targetWorkers: `"support" IN routing.skills`,
        friendlyName: 'Support'
    }
});

const salesTaskQueue = new Resource("sales-taskQueue", {
    resource: ["taskrouter", { "workspaces" : flexWorkspace.sid }, "taskQueues"],
    attributes: {
        targetWorkers: `"sales" IN routing.skills`,
        friendlyName: 'Sales'
    }
});


const everyoneTaskQueue = new Resource("everyone-taskQueue", {
    resource: ["taskrouter", { "workspaces" : flexWorkspace.sid }, "taskQueues"],
    attributes: {
        friendlyName: 'All Agents',
        targetWorkers: `1==1`
    }
});

const workflow = new Resource("transfer-workflow", {
    resource: ["taskrouter", { "workspaces" : flexWorkspace.sid }, "workflows"],
    attributes: {
        friendlyName: 'Chat Transfer Workflow',
        configuration: pulumi.all([supportTaskQueue.sid, salesTaskQueue.sid, everyoneTaskQueue.sid])
            .apply(([ supportTaskQueueSid, salesTaskQueueSid, everyoneTaskQueueSid ]) => JSON.stringify(
                {
                    task_routing: {
                        filters: [
                            {
                                friendlyName: "Everyone Queue",
                                expression: `transferTargetType == "worker"`,
                                targets: [
                                    {
                                        queue: everyoneTaskQueueSid,
                                        expression: `worker.sid == task.targetSid`
                                    }   
                                ] 
                            },
                            {
                                friendlyName: "Support Queue",
                                expression: `transferTargetType == "queue" AND targetSid == "${supportTaskQueueSid}"`,
                                targets: [
                                    {
                                        queue: supportTaskQueueSid
                                    }   
                                ]
                            },
                            {
                                friendlyName: "Sales Queue",
                                expression: `transferTargetType == "queue" AND targetSid == "${salesTaskQueueSid}"`,
                                targets: [
                                    {
                                        queue: salesTaskQueueSid
                                    }   
                                ]
                            }
                        ],
                        default_filter: {
                            queue: everyoneTaskQueueSid
                        }
                    }
                }
            ))
    },
});

const chatService = new Resource('chat-service', {
    resource: [
        'chat',
        'services'
    ],
    attributes: {
        friendlyName: 'Flex Chat Service'
    }
});

const messagingFlow = new Resource('messaging-flow', {
    resource: [
        'studio',
        'flows'
    ],
    attributes: {
        friendlyName: 'Messaging Flow',
        status: 'published'
    }
});

const flexFlow = new Resource('flex-flow',{
    resource: [
        'flexApi', 
        'flexFlow'
    ],
    attributes: {
        friendlyName: 'Whatsapp Flex Flow',
        chatServiceSid: chatService.sid,
        channelType: 'whatsapp',
        integrationType : 'studio',
        'integration.flowSid': messagingFlow.sid,
        contactIdentity : `whatsapp:${process.env.WHATSAPP_NUMBER}`,
        enabled: true
    }
});

/* Flex Localization Plugin */


const localizationServiceName = 'localization';
const localizationDomain = CheckServerless.getDomainName(localizationServiceName, stack);


const localizationServerless = new Serverless("localization-serverless", {
    attributes: {
      cwd: `./../plugins/plugin-flex-localization/default`,
      serviceName: localizationServiceName,
      env: {
        DOMAIN: localizationDomain
      },    
      functionsEnv: stack,
      pkgJson: require("./../plugins/plugin-flex-localization/default/package.json")
    }
});



const localizationFlexPlugin = new FlexPlugin("localization-flex-plugin", { 
    attributes: {
        cwd: "./../plugins/plugin-flex-localization",
        env: pulumi.all([localizationDomain]).apply(([ localizationDomain ]) => (
            {
                FLEX_APP_FUNCTIONS_BASE: `https://${localizationDomain}`
            }
        )),
        runTestsOnPreview: true
    }
});

/* Media Messages Plugin */

const mediaMessagesServiceName = 'mms-handler';
const mediaMessagesDomain = CheckServerless.getDomainName(mediaMessagesServiceName, stack);

const proxyService = new Resource('proxy-service',{
    resource: [
        'proxy', 
        'services'
    ],
    attributes: {
        uniqueName: 'Flex Proxy Service',
        callbackUrl: pulumi.all([mediaMessagesDomain]).apply(([ mediaMessagesDomain ]) => `https://${mediaMessagesDomain}/mms-handler`)

       
    }
});


const messagingService = new Resource('messaging-service',{
    resource: [
        'messaging', 
        'services'
    ],
    attributes: {
       friendlyName: 'Flex Messaging Service',
       inboundRequestUrl: pulumi.interpolate`https://webhooks.twilio.com/v1/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Proxy/${proxyService.sid}/Webhooks/Message`,
        inboundMethod: 'POST'
    }
});


const mediaMessagesServerless = new Serverless("media-messages-serverless", {
    attributes: {
      cwd: `./../plugins/plugin-message-media/mms-handler`,
      serviceName: mediaMessagesServiceName,
      env: {
        CHAT_SERVICE_SID: process.env.CHAT_SERVICE_SID,
        PROXY_SERVICE: proxyService.sid,
        TWILIO_WHATSAPP_NUMBER: process.env.WHATSAPP_NUMBER
      },    
      functionsEnv: stack,
      pkgJson: require("./../plugins/plugin-message-media/mms-handler/package.json")
    }
});

const mediaMessagesFlexPlugin = new FlexPlugin("media-messages-flex-plugin", { 
    attributes: {
        cwd: "./../plugins/plugin-message-media",
        env: pulumi.all([mediaMessagesDomain]).apply(([ mediaMessagesDomain ]) => (
            {
                REACT_APP_SEND_MEDIA_ENDPOINT: `https://${mediaMessagesDomain}/send-media-message`
            }
        )),
        runTestsOnPreview: true
    }
});

/* Chat Transfer Plugin */

const chatTransferServiceName = 'plugin-chat-sms-transfer-functions';
const chatTransferDomain = CheckServerless.getDomainName(chatTransferServiceName, stack);

const chatTransferServerless = new Serverless("chat-transfer-serverless", {
    attributes: {
      cwd: `./../plugins/plugin-chat-sms-transfer/functions`,
      serviceName: chatTransferServiceName,
      env: {
        TWILIO_WORKSPACE_SID: flexWorkspace.sid,
        TWILIO_CHAT_TRANSFER_WORKFLOW_SID: workflow.sid
      },    
      functionsEnv: stack,
      pkgJson: require("./../plugins/plugin-chat-sms-transfer/functions/package.json")
    }
});

const chatTransferFlexPlugin = new FlexPlugin("chat-transfer-flex-plugin", { 
    attributes: {
        cwd: "./../plugins/plugin-chat-sms-transfer",
        env: pulumi.all([chatTransferDomain]).apply(([ chatTransferDomain ]) => (
            {
                FLEX_APP_FUNCTIONS_BASE: `https://${chatTransferDomain}`
            }
        )),
        runTestsOnPreview: true
    }
});

/*Whatsapp Outbound Plugin*/

const workflowOutbound = new Resource("outbound-workflow", {
    resource: ["taskrouter", { "workspaces" : flexWorkspace.sid }, "workflows"],
    attributes: {
        friendlyName: 'Outbound Tasks Workflow',
        configuration: pulumi.all([everyoneTaskQueue.sid])
            .apply(([ everyoneTaskQueueSid ]) => JSON.stringify(
                {
                    task_routing: {
                        filters: [
                            {
                                friendlyName: "Everyone Queue",
                                expression: `direction == "outbound"`,
                                targets: [
                                    {
                                        queue: everyoneTaskQueueSid,
                                        known_worker_friendly_name: `task.worker`
                                    }   
                                ] 
                            }
                        ],
                        default_filter: {
                            queue: everyoneTaskQueueSid
                        }
                    }
                }
            ))
    },
});

const whatsappTaskChannel = new Resource('whatsapp-task-channel', {
    resource: [
        'taskrouter',
        {workspaces: flexWorkspace.sid},
        'taskChannels'
    ],
    attributes: {
        friendlyName: 'Chat',
        uniqueName: 'chat'
    }
});


const flexFlowOutbound = new Resource('flex-flow-outbound',{
    resource: [
        'flexApi', 
        'flexFlow'
    ],
    attributes: {
        friendlyName: 'Flex WhatsApp To Task Flow',
        chatServiceSid: chatService.sid,
        channelType: 'whatsapp',
        integrationType : 'task',
        'integration.workspaceSid': flexWorkspace.sid,
        'integration.workflowSid': workflowOutbound.sid,
        'integration.channel': whatsappTaskChannel.sid,
        contactIdentity : `whatsapp:${process.env.WHATSAPP_NUMBER}`,
        enabled: false,
        janitorEnabled: true
    }
});

const availableActivity = new Resource("available-activity", {
    resource: ["taskrouter", { "workspaces" : flexWorkspace.sid }, "activities"],
    attributes: {
        friendlyName: 'Available'
    }
});

const outboundWaServiceName = 'task-helper';
const outboundWaDomain = CheckServerless.getDomainName(outboundWaServiceName, stack);

const outboundWaServerless = new Serverless("outbound-whatsapp-serverless", {
    attributes: {
      cwd: `./../plugins/plugin-outbound-whatsapp/serverless`,
      serviceName: outboundWaServiceName,
      env: {
        TWILIO_CHAT_SERVICE_SID: chatService.sid,
        TWILIO_PROXY_SERVICE_SID: proxyService.sid,
        TWILIO_WHATSAPP_NUMBER: process.env.WHATSAPP_NUMBER
      },    
      functionsEnv: stack,
      pkgJson: require("./../plugins/plugin-outbound-whatsapp/serverless/package.json")
    }
});

const outboundWaFlexPlugin = new FlexPlugin("outbound-whatsapp-flex-plugin", { 
    attributes: {
        cwd: "./../plugins/plugin-outbound-whatsapp",
        env: pulumi.all([outboundWaDomain]).apply(([ outboundWaDomain ]) => (
            {
                REACT_APP_TASK_CREATION_ENDPOINT: `https://${outboundWaDomain}/create-wa-task`,
                REACT_APP_AVAILABLE_ACTIVITY_SID: availableActivity.sid

            }
        )),
        runTestsOnPreview: true
    }
});

/*Dialer Add-on*/

/*const voiceTaskChannel = getTaskChannel('voice', flexWorkspace.sid)
    .then(channel => channel);

//pulumi.log.info(pulumi.interpolate`${voiceTaskChannelSid}`);*/

const dialerAddonWorkflow = new Resource("dialer-addon-workflow", {
    resource: ["taskrouter", { "workspaces" : flexWorkspace.sid }, "workflows"],
    attributes: {
        friendlyName: 'Dialer Addon Workflow',
        configuration: pulumi.all([everyoneTaskQueue.sid])
            .apply(([ everyoneTaskQueueSid ]) => JSON.stringify(
                {
                    task_routing: {
                        filters: [
                            {
                                friendlyName: "Everyone Queue",
                                expression: `task.targetWorker == worker.contact_uri`,
                                targets: [
                                    {
                                        queue: everyoneTaskQueueSid,   
                                        priority: 1000,
                                        
                                    }
                                ] 
                            }
                        ],
                        default_filter: {
                            queue: everyoneTaskQueueSid
                        }
                    }
                }
            ))
    },
});

const dialerAddonServiceName = 'dialpad';
const dialerAddonDomain = CheckServerless.getDomainName(dialerAddonServiceName, stack);

const dialerAddonServerless = new Serverless("dialer-addon-serverless", {
    attributes: {
      cwd: `./../plugins/flex-dialpad-addon-plugin/serverless`,
      serviceName: dialerAddonServiceName,
      env: {
        TWILIO_NUMBER: process.env.TWILIO_NUMBER,
        TWILIO_WORKFLOW_SID: dialerAddonWorkflow.sid,
        TWILIO_WORKSPACE_SID: flexWorkspace.sid
      },    
      functionsEnv: stack,
      pkgJson: require("./../plugins/flex-dialpad-addon-plugin/serverless/package.json")
    }
});

const dialerAddonFlexPlugin = new FlexPlugin("dialer-addon-flex-plugin", { 
    attributes: {
        cwd: "./../plugins/flex-dialpad-addon-plugin",
        env: pulumi.all([dialerAddonDomain]).apply(([ dialerAddonDomain ]) => (
            {
                REACT_APP_SERVICE_BASE_URL: `https://${dialerAddonDomain}`,
                REACT_APP_TASK_CHANNEL_SID: process.env.TWILIO_VOICE_TASKCHANNEL_SID

            }
        )),
        runTestsOnPreview: true
    }
});

/* Event Streams */


const sink = process.env.STREAMS_ENDPOINT ? 
    new Resource('event-streams-sink', {
        resource: ['events', 'sinks'],
        attributes: {
            sinkType: 'webhook',
            description: 'Event Stream sink',
            sinkConfiguration: {
                destination: `${process.env.STREAMS_ENDPOINT}/events`,
                method: 'POST',
                batch_events: true
            }
        }
    })
    :{};

const subscriptions = process.env.STREAMS_ENDPOINT ? 
    new Resource('event-streams-subscriptions', {
        resource: ['events', 'subscriptions'],
        attributes: {
            description: 'Event Stream Subscriptions',
            types: [
                {
                    type: 'com.twilio.studio.flow.step.ended'
                },
                {
                    type: 'com.twilio.studio.flow.execution.started'
                },
                {
                    type: 'com.twilio.studio.flow.execution.ended'
                }
            ],
            sinkSid: sink.sid
        }
    })
    :{};






export let output = {
    flexWorkspace: flexWorkspace.sid,
    chatService: chatService.sid,
    flexFlow: flexFlow.sid,
    proxyService: proxyService.sid,
    messagingService: messagingService.sid,
    localizationServerless: localizationServerless.sid,
    localizationFlexPlugin: localizationFlexPlugin.sid,
    mediaMessagesServerless: mediaMessagesServerless.sid,
    mediaMessagesFlexPlugin: mediaMessagesFlexPlugin.sid,
    flexFlowOutbound: flexFlowOutbound.sid,
    dialerAddonWorkflow: dialerAddonWorkflow.sid,
    dialerAddonServerless: dialerAddonServerless.sid,
    dialerAddonFlexPlugin: dialerAddonFlexPlugin.sid,
    sink: sink.sid,
    subscriptions: subscriptions.sid
}