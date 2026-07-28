function healthCheck(): {
  status: "ok";
  service: "automatisation-support";
} {
  return {
    status: "ok",
    service: "automatisation-support"
  };
}

export {
  healthCheck
};
