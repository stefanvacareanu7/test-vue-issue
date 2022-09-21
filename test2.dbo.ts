import { ApiProperty } from '@nestjs/swagger';

export default class InstitutionDTO {
    @ApiProperty({
        type: Number,
        description: 'Institution ID',
        example: 1001,
    })
    id: number;

    @ApiProperty({
        type: Number,
        description: 'ID of campus where the course will be provided',
        example: 185,
    })
    campusId: number;
}