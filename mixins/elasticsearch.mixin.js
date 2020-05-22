"use strict";

require("dotenv").config();

const { MoleculerError } = require("moleculer").Errors;
const Elasticsearch = require("elasticsearch");
const MESSAGE_CONSTANT = require("../lib/Constants");
const Common = require("./common.mixin");
const elasticClient = new Elasticsearch.Client({
	host: process.env.ELASTICSEARCH_HOST
});

module.exports = {
	name: "elasticsearch",
	mixins: [Common],
	methods: {
		getEsObject: function () {
			return elasticClient;
		},

		registration: async function (data) {
			return await elasticClient
				.search({
					index: "users",
					type: "_doc",
					body: {
						query: {
							bool: {
								must: { match: { email: data.email } }
							}
						}
					},
					size: 1
				})
				.then(result => {
					if (result.hits.total.value > 0) {
						throw new MoleculerError(MESSAGE_CONSTANT.EMAIL_EXIST, 409);
					}
					else {
						return elasticClient
							.index({
								index: "users",
								type: "_doc",
								body: {
									name: data.name,
									email: data.email,
									password: this.hashPassword(data.password)
								}
							})
							.then(result => {
								return Promise.resolve({
									id: result._id
								});
							})
							.catch(() => {
								throw new MoleculerError(MESSAGE_CONSTANT.SOMETHING_WRONG, 500);
							});
					}
				});
		},

		login: async function (data) {
			return await elasticClient
				.search({
					index: "users",
					type: "_doc",
					body: {
						query: {
							bool: {
								must: { match: { email: data.email } }
							}
						}
					},
					size: 1
				})
				.then(async result => {
					if (result.hits.total.value === 0) {
						throw new MoleculerError(MESSAGE_CONSTANT.USER_NOT_EXIST, 404);
					} else {
						let passwordIsValid = await this.comparePassword(
							result.hits.hits[0]._source.password,
							data.password
						);
						if (!passwordIsValid)
							throw new MoleculerError(MESSAGE_CONSTANT.INVALID_CRED, 401);
						return await this.generateToken({
							id: result.hits.hits[0]._id
						}).then(function (token) {
							return Promise.resolve({
								token: token,
								user: {
									name: result.hits.hits[0]._source.name,
									id: result.hits.hits[0]._id
								}
							});
						});
					}
				});
		},

		fatch_user: async function (data) {
			return await elasticClient
				.search({
					index: "users",
					type: "_doc",
					body: {
						query: {
							bool: {
								must: { match: { _id: data.id } }
							}
						}
					},
					size: 1
				})
				.then(async (result) => {
					if (result.hits.total.value === 0) {
						throw new MoleculerError(MESSAGE_CONSTANT.USER_NOT_EXIST, 404);
					}
					else {
						return Promise.resolve({
							user: {
								email: result.hits.hits[0]._source.email,
								name: result.hits.hits[0]._source.name,
								id: result.hits.hits[0]._id
							}
						});
					}
				})
				.catch(() => {
					throw new MoleculerError(MESSAGE_CONSTANT.USER_NOT_EXIST, 500);
				});
		},

		getProducts: async function () {
			return await elasticClient
				.search({
					index: "products",
					type: "_doc",
					body: {
						query: {
							match_all: {}
						}
					}
				})
				.then(result => {
					if (result.hits.total === 0) {
						return Promise.resolve({
							products: []
						});
					}
					const products = result.hits.hits.map(product => ({
						id: product._id,
						name: product._source.name,
						sku: product._source.sku,
						category: product._source.category
					}));
					return Promise.resolve({
						products: products
					});
				})
				.catch(() => {
					throw new MoleculerError(MESSAGE_CONSTANT.SOMETHING_WRONG, 500);
				});
		},

		product_exists: async function (data) {
			return await elasticClient
				.exists({
					index: "products",
					type: "_doc",
					id: data.id
				})
				.then(result => result)
				.catch(() => {
					throw new MoleculerError(MESSAGE_CONSTANT.SOMETHING_WRONG, 500);
				});
		},

		fatch_product: async function (data) {
			return await elasticClient
				.search({
					index: "products",
					type: "_doc",
					body: {
						query: {
							bool: {
								filter: {
									term: {
										_id: data.id
									}
								}
							}
						}
					}
				})
				.then(result => {
					if (result.hits.total.value === 0) {
						return false;
					}
					return {
						id: result.hits.hits[0]._id,
						name: result.hits.hits[0]._source.name,
						sku: result.hits.hits[0]._source.sku,
						category: result.hits.hits[0]._source.category
					};
				})
				.catch(() => {
					throw new MoleculerError(MESSAGE_CONSTANT.SOMETHING_WRONG, 500);
				});
		}
	}
};
