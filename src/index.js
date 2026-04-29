function healthCheck() {
  return {
    status: "ok",
    service: "automatisation-support"
  };
}

module.exports = {
  healthCheck
};
