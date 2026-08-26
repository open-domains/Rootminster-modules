export default {
 async install({logger}) { logger.info("Example module installed"); },
 async health() { return {ok:true}; }
};
