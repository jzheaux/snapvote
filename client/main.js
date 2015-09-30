require(["jquery", "mustache", "sammy", "sammy-mustache"], function($, Mustache, Sammy, SM) {
  var app = Sammy('#main', function() {
    // include a plugin
    this.use('Mustache');

    // define a 'route'
    this.get('#/vote/:vote', function() {
      // load some data
      this.load('vote/' + this.params.vote, { json : true })
          // render a template
          .render('client/views/vote.mustache')

          // swap the DOM with the new content
          .swap(function() {
            $("#cast-vote").click(function() {
                var questionId = $("#answers").data("question-id");
                var answerId = $("input[name=answerId]:checked").val();
                if ( answerId && questionId ) {
                    $.ajax({
                        url : 'vote/' + questionId + '/answer/' + answerId + '/cast',
                        method : 'POST',
                        dataType : 'json',
                        contentType : 'application/hal+json'
                    })
                    .done(function(data) {
                        location.reload();
                    })
                    .error(function() {
                        location.reload();
                    });
                } else {
                    alert ("Please select something first.");
                }
            });
        });
            
    })

	.get('#/vote-add', function() {
		this.render('client/views/vote/add.mustache')
			.swap(function() {
				$(".extendable-list").each(function(idx, ul) {
					var id = ul.id;
					$(ul).append("<li><input name='" + id + "'/><span class='remove'/></li>");
					$(".extendable-list .remove").click(function(span) {
						$(span).parent().remove();
					});
				});

		
	
				$(".extendable-list").after("<input type='button' class='add' value='Add'/>");
		
				// TODO, the rest of the code above is relatively generic, but the
				// following code is very q/a specific. It would be nice if we could
				// parameterize the code below so that the whole thing can be wrapped
				// into a jQuery plugin.
				$(".extendable-list + .add").click(function() {
					var id = $(this).prev()[0].id;
					$(this).prev().append("<li><input name='" + id + "'/><span class='remove'/></li>");
					$(".extendable-list .remove").click(function(span) {
						$(span).parent().remove();
					});
				});
			});
	})
	

	.post('#/vote', function(context) {
		var vote = {};
			vote.question = $("#question").val();
			vote.answers = $("input[name='answers']").map(function() { return { "text" : $(this).val() }; }).get();
            vote.duration = $("#duration").val();
            vote.maximumVotes = $("#count").val();
            vote.whenAreResultsPublic = $("input[name='tallyVisibility']:checked").val();
        
			$.ajax({
				url : 'vote',
				method : 'POST',
				data : JSON.stringify(vote),
				dataType : 'json',
				contentType : 'application/hal+json'
			})
			.done(function(data) {
				location.hash = '#/vote/' + data.id;
			});
	});
  });

  app.run('#/');
});
