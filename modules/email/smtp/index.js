import nodemailer from "nodemailer";
export default {
 async health({config}){const t=nodemailer.createTransport({host:config.host,port:config.port,secure:config.secure,auth:config.username?{user:config.username,pass:config.password}:undefined});await t.verify();return {ok:true};},
 async send({config},message){const t=nodemailer.createTransport({host:config.host,port:config.port,secure:config.secure,auth:config.username?{user:config.username,pass:config.password}:undefined});return t.sendMail({from:config.from,...message});}
};
