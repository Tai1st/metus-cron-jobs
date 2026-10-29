import { getFBHeaders } from '@/common/utils';
import { FacebookAccount } from '@/schemas';
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class FacebookService {
    constructor(private readonly http: HttpService) {}

    async publishEffectiveObjectStory(
        effectiveStoryObjectId: string,
        accessToken: string,
        facebookAccount?: Pick<FacebookAccount, 'cookie'>,
    ) {
        const { data } = await firstValueFrom(
            this.http.post(
                `https://graph.facebook.com/v17.0/${effectiveStoryObjectId}`,
                { is_published: true, access_token: accessToken },
                { headers: getFBHeaders(facebookAccount?.cookie) },
            ),
        );
        return data;
    }
}
