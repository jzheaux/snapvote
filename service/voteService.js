var crypto = require("crypto");
var restify = require("restify");
var db = require(__dirname + '/../db');
var Vote = db.Vote;
var Answer = db.Answer;
var Cast = db.Cast;

var _exports = {};

_exports.validateClient = function (credentials, req, cb) {
    // Call back with `true` to signal that the client is valid, and `false` otherwise.
    // Call back with an error if you encounter an internal server error situation while trying to validate.
	
    var isValid = true; // for now
    return cb(null, isValid);
};

module.exports = function(server) {
	var hasAlreadyVotedOn = function(vote, hash, cb) {
		vote.getAnswers().then(function(answers) {
			hasAlreadyVotedOnAnswer(answers, 0, hash, cb);
		});
	}

    var hasAlreadyVotedOnAnswer = function(answers, index, hash, cb) {
        answers[index].getCasts().then(function(casts) {
            doesCastBelongTo(answers, index, casts, 0, hash, cb);
        });
    }
    
    var doesCastBelongTo = function(answers, aIndex, casts, index, hash, cb) {
        if ( index < casts.length && casts[index].hash == hash ) {
            cb(true);
        } else if ( casts.length > index + 1 ) {
            doesCastBelongTo(answers, aIndex, casts, index + 1, hash, cb);
        } else if ( answers.length > aIndex + 1 ) {
            hasAlreadyVotedOnAnswer(answers, aIndex + 1, hash, cb);
        } else {
            cb(false);
        }
    }
    
	server.get('/votes/index', function (req, res, next) {
		Vote.findAll()
			.complete(function(error, votes) {
				if ( error ) return next(new restify.InvalidArgumentError(JSON.stringify(error.errors)));

				if ( votes ) {
					res.send(votes.values);
				} else {
					res.send(404);
				}
			});
        });

    var addResultToResults = function(source, destination, index, total, cb) {
		if ( destination.answers.length == source.length ) {
			destination.total = { "amount" : total };
			cb(destination);
		} else {
			var answer = source[index];
			answer.getCasts().then(function(casts) {
				var tally = { "text" : answer.text, "total" : { "amount" : casts.length } };
				destination.answers.push(tally);
				addResultToResults(source, destination, index + 1, total + casts.length, cb);
			});
		}
	}

	var getResults = function(vote, cb) {
		var results = {};
		results.question = vote.question;
		results.answers = [];
		vote.getAnswers().then(function(answers) {
			addResultToResults(answers, results, 0, 0, cb);
		});
	}

	var getTotalVotes = function(vote, cb) {
		getResults(vote, function(results) { cb(results.total); });
	}

	var isFinished = function(vote, cb) {
		getTotalVotes(vote, function(total) {
			cb(vote.endTime < new Date() || total >= vote.maximumVotes);
		});
	}

	var canSeeResults = function(vote, hash, cb) {
		isFinished(vote, function(finished) {
			var canSee = vote.hash == hash || 
			( finished && vote.whenAreResultsPublic == 'AFTER' ) ||
			( vote.whenAreResultsPublic == 'BEFORE' );
			cb(canSee);
		});
	}

    server.get('/vote/:id', function (req, res, next) {
		res.header('Content-Type', 'application/json');
		Vote.find({ where : { id : req.params.id }})
			.complete(function(error, vote) {
				if (error) return next(new restify.InvalidArgumentError(JSON.stringify(error.errors)))
		 
				if ( vote ) {
					if ( vote.hash == req.hash ) {
						console.log("Showing results to owner");
						getResults(vote, function(results) {
							res.send(results);
						});
					} else {
						hasAlreadyVotedOn(vote, req.hash, function(voted) {
							if ( voted ) {
								console.log("This user already voted...");
								canSeeResults(vote, req.hash, function(canSee) {
									if ( canSee ) {
										getResults(vote, function(results) {
                                            res.send(results);										
										});
									} else {
										res.send({ "description" : "Thanks for voting!" });														
									}
								});
							} else {
								isFinished(vote, function(finished) {
									if ( finished ) {
										console.log("The voting is done...");
										canSeeResults(vote, req.hash, function(canSee) {
											if (canSee) {
												getResults(vote, function(results) {
	                                               res.send(results);
                                                });
											} else {
												res.send({ "description" : "The vote is closed."});
											}
										});
									} else {
										console.log("This user can vote...");								
										var poll = {};
										poll.id = vote.values.id;
										poll.question = vote.values.question;
										vote.getAnswers().then(function(answers) {
											poll.answers = answers;
											res.send(poll);
										});
									}
								});
							}
								
						});
					}
				} else {
					res.send(404);
				}
			});
        });

	server.post('/vote', function (req, res, next) {
		var vote = JSON.parse(req.body);

		var errors = {};

		console.log(vote);

		if ( !vote.question ) {
			errors.question = "Question is missing";
		}

		if ( !vote.answers.length || !vote.answers[0] ) {
			errors.answers = "Need at least one answer";
		}

		if ( errors.question || errors.answers ) {
			return next(new restify.InvalidArgumentError(JSON.stringify(errors)));
		}

        if ( vote.duration ) {
            vote.endTime = new Date(new Date().getTime() + vote.duration * 60 * 60 * 1000);;
        }
		vote.minimumVotes = vote.minimumVotes || 1;
		vote.endTime = vote.endTime || new Date(new Date().getTime() + 24 * 60 * 60 * 1000);
		vote.startTime = vote.startTime || new Date();
		vote.randomizeAnswerOrder = vote.randomizeAnswerOrder || false;
		vote.whenAreResultsPublic = vote.whenAreResultsPublic || 'AFTER';
		vote.hash = req.hash;
		var answers = vote.answers;

		Vote.create(vote)
				.complete(function(err, vote) {
					if (!!err) {
						return next(new restify.InvalidArgumentError(JSON.stringify(error.errors)));
					}
					console.log(vote);
					console.log(answers);

					for ( var i = 0; i < answers.length; i++ ) {
						Answer.create(answers[i])
							.complete(function(err, answer) {
								vote.addAnswer(answer);
							});
					}

					res.send(201, vote.values);
				});

	});

    server.post('/vote/:voteId/answer/:answerId/cast', function (req, res, next) {
 		var cast = {};
		cast.hash = req.hash;

		Answer.find({ where : { id : req.params.answerId }})
			.complete(function(error, answer) {
				if (error) return next(new restify.InvalidArgumentError(JSON.stringify(error.errors)));

				if ( answer ) {
					answer.getVote().then(function(vote) {
						if ( vote.endTime < new Date() ) {
							res.send(400, { description : "This vote has already ended" });
						} else {
							getTotalVotes(vote, function(total) {
								if ( vote.maximumVotes && total >= vote.maximumVotes ) {
									res.send(400, { description : "This vote's tally is full" });		
								} else if ( vote.startTime && vote.startTime > new Date() ) {
									res.send(400, { description : "This vote has not yet started" });
								} else {
									hasAlreadyVotedOn(vote, req.authorization.credentials, function(already) {
										if ( already ) {
											res.send(400, { description : "You have already voted on this question." });
										} else {
											Cast.create(cast)
												.complete(function(error, created) {
													if ( !!error ) 
														return next(new restify.InvalidArgumentError(JSON.stringify(error.errors)));

													answer.addCast(created);
													res.send(201, { "description" : "Your vote of " + answer.text + " for " + vote.question + " was cast." });			
												});
										}
									});
								}
							});
						} 

						
					});
				} else {
					res.send(404);
				}
			});
        });
	
	return _exports;
}

