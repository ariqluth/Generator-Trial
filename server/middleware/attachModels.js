import * as models from '../models/index.js';

export default function attachModels(req, res, next) {
    req.models = models;
    next();
}
