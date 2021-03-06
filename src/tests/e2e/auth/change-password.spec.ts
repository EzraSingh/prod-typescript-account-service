import { createSandbox, SinonSandbox, fake } from 'sinon';
import * as chai from 'chai';
import * as request from 'supertest';
import * as classValidator from 'class-validator';
import 'mocha';

import * as typeorm from 'typeorm';
import { app } from '../../../index';

import { User, UserRole } from '../../../models/User';
import { signToken } from '../../../utils';
import { passwordValidator } from '../../../controllers/AuthController';

describe('Accounts Change Password API', () => {
	describe('POST /api/auth/change-password', async () => {
		let sandbox: SinonSandbox;
		let mockUser: User;
		let payload: {
			oldPassword: string;
			newPassword: string;
			confirmPassword: string;
		};
		let tokenHook: Function;
		let requestHook: Function;

		before(() => {});

		beforeEach(() => {
			mockUser = new User();
			mockUser.email = 'user@app.com';
			mockUser.role = UserRole.CUSTOMER;
			mockUser.password = 'userPASS123';
			mockUser.hashPassword();

			payload = {
				oldPassword: 'userPASS123',
				newPassword: 'newPASS123',
				confirmPassword: 'newPASS123',
			};

			sandbox = createSandbox();

			tokenHook = (user?: User): string => {
				return signToken(user);
			};

			requestHook = (token?: string) => {
				return request(app.server)
					.post('/api/auth/change-password')
					.set('Authorization', `Bearer ${token}`);
			};
		});

		afterEach(() => {
			sandbox.restore();
		});

		it('should deflect if missing JWT', async () => {
			const res = await requestHook().expect(401);
			chai.expect(res.body.message).to.be.a('string');
		});

		it('should deflect if missing body', async () => {
			const userToken = tokenHook(mockUser);
			const res = await requestHook(userToken).expect(400);
			chai.expect(res.body.message).to.be.a('string');
		});

		it('should deflect if new password fails validation', async () => {
			sandbox
				.stub(passwordValidator, 'checkPassword')
				.returns({ isValid: false, validationMessage: 'error' });

			const userToken = tokenHook(mockUser);
			const res = await requestHook(userToken).send(payload).expect(401);

			chai.expect(res.body.message).to.be.an('string');
		});

		it('should deflect if new password fails confirmation', async () => {
			payload.confirmPassword = 'notmypass';

			sandbox
				.stub(passwordValidator, 'checkPassword')
				.returns({ isValid: true });

			const userToken = tokenHook(mockUser);
			const res = await requestHook(userToken).send(payload).expect(400);
			chai.expect(res.body.message).to.be.a('string');
		});

		it('should deflect if user does not exist', async () => {
			sandbox
				.stub(passwordValidator, 'checkPassword')
				.returns({ isValid: true });

			sandbox.stub(typeorm, 'getRepository').returns({
				findOneOrFail: fake.throws('user does not exist'),
			} as any);

			const userToken = tokenHook(mockUser);
			const res = await requestHook(userToken).send(payload).expect(401);
			chai.expect(res.body.message).to.be.a('string');
		});

		it('should deflect if old password fails verification', async () => {
			payload.oldPassword = 'wrongpass';
			sandbox
				.stub(passwordValidator, 'checkPassword')
				.returns({ isValid: true });

			sandbox
				.stub(typeorm, 'getRepository')
				.returns({ findOneOrFail: fake.resolves(mockUser) } as any);

			const userToken = tokenHook(mockUser);
			const res = await requestHook(userToken).send(payload).expect(401);
			chai.expect(res.body.message).to.be.a('string');
		});

		it('should deflect if user validation fails', async () => {
			sandbox
				.stub(passwordValidator, 'checkPassword')
				.returns({ isValid: true });

			sandbox
				.stub(typeorm, 'getRepository')
				.returns({ findOneOrFail: fake.resolves(mockUser) } as any);

			sandbox.replace(classValidator, 'validate', fake.resolves([, ,]));

			const userToken = tokenHook(mockUser);
			const res = await requestHook(userToken).send(payload).expect(400);
			chai.expect(res.body.errors).to.be.an('array');
		});

		it("should update user's password", async () => {
			sandbox
				.stub(passwordValidator, 'checkPassword')
				.returns({ isValid: true });

			sandbox.stub(typeorm, 'getRepository').returns({
				findOneOrFail: fake.resolves(mockUser),
				save: fake(),
			} as any);

			sandbox.replace(classValidator, 'validate', fake.resolves([]));

			const userToken = tokenHook(mockUser);
			const res = await requestHook(userToken).send(payload).expect(201);
			chai.expect(res.body.message).to.be.a('string');
		});
	});
});
