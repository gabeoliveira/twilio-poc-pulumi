# Twilio Environment Builder

With the purpose of making it easier to spin up new Twilio environments, especially those that use Flex, this Pulumi script takes a newly created account (although it will also work with accounts that are already in use) and take many manual steps out of the user's hands, like setting up sample queues, preparing Whatsapp for Flex use and deploying some of the most used plugins.

## Flex Plugins Installed
* Whatsapp Media Messages
* Whatsapp Outbound Messages
* Chat Tasks Transfers
* Flex Localization

## Console Setup Steps Executed
* Two Sample Queues (Support and Sales)
* Messaging Service for Flex
* Whatsapp Flex Flow
* Flex Plugins Functions and Needed Setup
* Event Streams Sink (optional)
 

# Setup

## Requirements

Before starting setup, make sure you have the tools below installed:

1. [Twilio CLI](https://www.twilio.com/docs/twilio-cli/quickstart)
2. [Twilio Infra Plugin](https://github.com/kaiquelupo/plugin-twilio-infra)
3. [Pulumi CLI](https://www.pulumi.com/docs/reference/cli/)

## Deployment

1. Log into your new account, providing the info Twilio CLI asks for


    `twilio login`

2. Clone this repository `git clone https://github.com/gabeoliveira/twilio-poc-pulumi.git`
3. Navigate into the project folder
4. Run `source setup.sh [name of your project]` (It creates the Twilio Infra project, clones submodules and setup the Pulumi script within the project. If you wish to know exactly which commands it runs, check [here](https://github.com/gabeoliveira/twilio-poc-pulumi/blob/main/setup.sh))
5. Run `twilio infra:deploy` (**IMPORTANT:** During the Preview step, Pulumi will say that resources related to TaskRouter couldn't be found. That's normal, as we don't have access to the Workspace SID yet)

**OBSERVATION:** During the first deploy, some Flex Plugins might raise a conflict error. It will happen if you have other Twilio Projects that run the same Plugin and are using the same terminal as the other project. This is because of a environment conflict. If it happens, just deploy the project again.


# Modifying your Project

The main advantage of using an Infrastructure as Code approach is that you can change things on your script without having to worry about conflicts and maintenance. This script contains sample queues and workflows so you can setup yours by just modifying or creating new queues directly on the script.

If you need to add new resources (SIP Trunks, new services, new Functions, etc), please follow the [Twilio Pulumi Provider](https://github.com/kaiquelupo/twilio-pulumi-provider-example) example. Please note that this provider is not officially supported by Twilio.

# Credits

This script was built using the Twilio Pulumi Provider and Twilio Infra-as-code Plugin. Both of them were built by [Kaíque Lupo](https://github.com/kaiquelupo)