const HelpDesk = global.HelpDesk = {};

HelpDesk.filename = function(oid, extension) {

	var name = oid.toString();
	var count = 0;

	for (var i = 0, length = name.length; i < length; i++)
		count += name.charCodeAt(i);

	return name + 'x' + count + extension;
};

HelpDesk.notify = function(type, user, idticket, idcomment) {

	// 0 == create
	// 1 == close
	// 2 == reopen
	// 5 == assign
	// 9 == comment

	var sql = DB();

	sql.select('ticket', 'tbl_ticket').make(function(builder) {
		builder.fields('id', 'idsolver', 'iduser', 'name', 'project');
		builder.where('id', idticket);
		builder.first();
	});

	sql.validate('ticket', 'error-ticket-404');

	// Select all users according to comments
	if (type !== 5) {
		sql.query('users', 'SELECT a.iduser, b.email FROM tbl_ticket_comment a INNER JOIN tbl_user b ON b.id=a.iduser').make(function(builder) {
			builder.where('b.isnotification', true);
			builder.where('b.isremoved', false);
			builder.where('b.isactivated', true);
			builder.where('a.idticket', idticket);
			builder.group('iduser', 'email');
		});
	}

	// Checks ticket solvers
	sql.prepare(function(error, response, resume) {

		if (type !== 5 && response.ticket.idsolver)
			return resume();

		sql.query('support', 'SELECT id as iduser, email, name FROM tbl_user').make(function(builder) {
			builder.where('iscustomer', false);
			builder.where('isnotification', true);
			builder.where('isremoved', false);
			builder.where('isactivated', true);
			builder.where('isconfirmed', true);
		});

		resume();
	});

	// Select owner
	sql.prepare(function(error, response, resume) {

		if (response.users.findIndex('id', response.ticket.iduser) !== -1)
			return resume();

		sql.select('owner', 'tbl_user').make(function(builder) {
			builder.fields('id as iduser', 'email', 'company', 'position');
			builder.where('id', response.ticket.iduser);
			builder.first();
		});

		resume();
	});


	sql.exec(function(err, response) {

		response.user = user;

		var email = [];
		var messages = [];

		// Association
		if (type === 5) {

			// Add owner
			if (response.user)
				response.support.push(response.user);

			response.support.forEach(function(item) {

				if (item.iduser === user.id)
					return;

				var message = Mail.create('Ticket has been associated: {0}'.format(response.ticket.name.max(50)), F.view('mails/notify-assign', response));
				message.from(CONFIG('mail.address.from'));
				message.to(item.email);
				messages.push(message);
			});

			messages.length && Mail.send2(messages);
			return;
		}

		// Closed
		if (type === 1) {

			// Add owner
			if (response.owner)
				response.users.push(response.owner);

			response.users.forEach(function(item) {

				if (item.iduser === user.id)
					return;

				var message = Mail.create('Ticket has been closed: {0}'.format(response.ticket.name.max(50)), F.view('mails/notify-close', response));
				message.from(CONFIG('mail.address.from'));
				message.to(item.email);
				messages.push(message);
			});

			messages.length && Mail.send2(messages);
			return;
		}

		// Re-opened
		if (type === 2) {

			// Add owner
			if (response.owner)
				response.users.push(response.owner);

			response.users.forEach(function(item) {

				if (item.iduser === user.id)
					return;

				var message = Mail.create('Ticket has been re-opened: {0}'.format(response.ticket.name.max(50)), F.view('mails/notify-reopen', response));
				message.from(CONFIG('mail.address.from'));
				message.to(item.email);
				messages.push(message);
			});

			messages.length && Mail.send2(messages);
			return;
		}

		if (type === 0) {

			// new ticket
			response.support.forEach(function(item) {

				if (item.id === user.id)
					return;

				var message = Mail.create('New ticket: {0}'.format(response.ticket.name.max(50)), F.view('mails/notify-create', response));
				message.from(CONFIG('mail.address.from'));
				message.to(item.email);
				messages.push(message);
			});

			messages.length && Mail.send2(messages);
			return;
		}

		if (type === 9) {

			response.idcomment = idcomment;

			// new comment
			response.users.forEach(function(item) {

				if (item.id === user.id)
					return;

				var message = Mail.create('New comment: {0}'.format(response.ticket.name.max(50)), F.view('mails/notify-comment', response));
				message.from(CONFIG('mail.address.from'));
				message.to(item.email);
				messages.push(message);
			});

			messages.length && Mail.send2(messages);
			return;
		}

	});

};