import { Request, Response } from 'express';
import { getRepository } from 'typeorm';
import { validate } from 'class-validator';

import { User } from '../models/User';

class UserController {
	static listAll = async (_req: Request, res: Response) => {
		// ? Get users from db
		const userRepository = getRepository(User);
		let users: User[];
		users = await userRepository.find({
			// ! DO NOT INCLUDE PASSWORD IN SELECTION QUERY
			select: ['id', 'email', 'role', 'lastLogin', 'loginCount'],
			relations: ['profile'],
		});

		res.status(200).send({ users });
	};

	static getUser = async (req: Request, res: Response) => {
		// ? Get ID from URL
		const id: number = +req.params.id;

		// ? Get user from db
		const userRepository = getRepository(User);
		let user: User;
		try {
			user = await userRepository.findOneOrFail(id, {
				// ! DO NOT INCLUDE PASSWORD IN SELECTION QUERY
				select: ['id', 'email', 'role', 'lastLogin', 'loginCount'],
				relations: ['profile'],
			});
		} catch (error) {
			res.status(404).send({ message: 'user not found' });
			return;
		}

		res.status(200).send({ user });
	};

	static createUser = async (req: Request, res: Response) => {
		// ? get parameters from the body
		const { email, password, role } = req.body;

		if (!(email && password && role)) {
			res.status(400).send({ message: 'missing request body' });
			return;
		}

		// ? create user entity
		const user = new User();
		user.email = email;
		user.password = password;
		user.role = role;

		// ? validate user entry
		const errors = await validate(user);
		if (errors.length > 0) {
			res.status(400).send({ errors });
			return;
		}

		// ? hash password to securely store credentials
		user.hashPassword();

		// ? try to store user, else email is already taken
		const userRepository = getRepository(User);
		try {
			await userRepository.save(user);
		} catch (error) {
			res.status(409).send({ message: 'email already in use' });
			return;
		}

		res.status(201).send({ message: 'user created' });
	};

	static updateUser = async (req: Request, res: Response) => {
		// ? Get ID from URL
		const id: number = +req.params.id;

		// ? Get parameters from body
		const { email, role } = req.body;
		if (!(email || role)) {
			res.status(400).send({ message: 'missing request body' });
			return;
		}

		// ? Try to find user in db
		const userRepository = getRepository(User);
		let user: User;
		try {
			user = await userRepository.findOneOrFail(id);
		} catch (error) {
			res.status(404).send({ message: 'user not found' });
			return;
		}

		// ? Validate updated values on the model
		user.email = email ? email : user.email;
		user.role = role ? role : user.role;
		const errors = await validate(user);
		if (errors.length > 0) {
			res.status(400).send({ errors });
			return;
		}

		// ? Try to store user, else username is already taken
		try {
			await userRepository.save(user);
		} catch (error) {
			res.status(409).send({ message: 'username already in use' });
			return;
		}

		res.status(201).send({ message: 'user updated' });
	};

	static deleteUser = async (req: Request, res: Response) => {
		// ? Get ID from the url
		const id: number = +req.params.url;

		// ? Search for user in db
		const userRepository = getRepository(User);
		let user: User;
		try {
			user = await userRepository.findOneOrFail(id);
		} catch (error) {
			res.status(404).send({ message: 'user not found' });
			return;
		}

		// ? Remove user from db
		userRepository.delete(user);

		res.status(204).send();
	};

	static whoami = async (_req: Request, res: Response) => {
		// ? retrieve user Id from JWT payload
		const { userId } = res.locals.jwtPayload;

		// ? Get user from db
		const userRepository = getRepository(User);
		let user: User;
		try {
			user = await userRepository.findOneOrFail(userId, {
				// ! DO NOT INCLUDE PASSWORD IN SELECTION QUERY
				select: ['id', 'email', 'role', 'lastLogin', 'loginCount'],
				relations: ['profile'],
			});
		} catch (error) {
			res.status(404).send({ message: 'auth token is stale' });
			return;
		}

		res.status(200).send({ user });
	};
}

export default UserController;
