// translate queartz cron to chinese
// i assume that the input is standard quartz cron and i wont check it

abstract class CronField {
	public abstract accept(visitor: FieldVisitor, type: Type): string;
}
class ListField extends CronField {
	public items: CronField[];
	constructor(items: CronField[]) { super(); this.items = items; }
	public accept(visitor: FieldVisitor, type: Type): string {
		return visitor.visitList(this, type);
	}
}
class StepField extends CronField {
	public base: CronField;
	public step: number;
	constructor(base: CronField, step: number) { super(); this.base = base; this.step = step; }
	public accept(visitor: FieldVisitor, type: Type): string {
		return visitor.visitStep(this, type);
	}
}
class RangeField extends CronField {
	public start: CronField;
	public end: CronField;
	constructor(start: CronField, end: CronField) { super(); this.start = start; this.end = end; }
	public accept(visitor: FieldVisitor, type: Type): string {
		return visitor.visitRange(this, type);
	}
}
class AtomField extends CronField {
	public value: string;

	constructor(value: string) { super(); this.value = value; }
	public accept(visitor: FieldVisitor, type: Type): string {
		return visitor.visitAtom(this, type);
	}
}

class CronExpression {
	public fields: CronField[];

	constructor(cron: string, parser: Parser) {
		const fields: string[] = cron.split(" ");
		this.fields = [];

		for (let i: number = 0; i < fields.length; i++) {
			this.fields.push(parser.parse(fields[i]));
		}
	}
}

//以责任链的形式解析field (这真的提高可读性了吗感觉不如ifelse)
abstract class Parser {
	private next_parser?: Parser;

	public setNext(next: Parser): Parser {
		this.next_parser = next;
		return this.next_parser;
	}
	public getNext(): Parser | undefined { return this.next_parser; }
	public parse(field: string): CronField {
		if (this.canHandle(field))
			return this.handle(field);
		else {
			//由于假设cron合法因此代码中不会做任何校验,这里必然会返回一个cronfield,那也就不用管next_parser是否为空了
			return this.next_parser!.parse(field);
		}
	}

	protected abstract canHandle(field: string): boolean;
	protected abstract handle(field: string): CronField;
}
class ListParser extends Parser {
	protected canHandle(field: string): boolean {
		return field.includes(",");
	}
	protected handle(field: string): CronField {
		const subfields: string[] = field.split(",");
		const items: CronField[] = [];
		for (let i: number = 0; i < subfields.length; i++) {
			items[i] = this.getNext()!.parse(subfields[i]);
		}
		return new ListField(items);
	}
}
class StepParser extends Parser {
	protected canHandle(field: string): boolean {
		return field.includes("/");
	}
	protected handle(field: string): CronField {
		const subfields: string[] = field.split("/");
		return new StepField(this.getNext()!.parse(subfields[0]), Number(subfields[1]));
	}
}
class RangeParser extends Parser {
	protected canHandle(field: string): boolean {
		return field.includes("-");
	}
	protected handle(field: string): CronField {
		const subfields = field.split("-");
		return new RangeField(this.getNext()!.parse(subfields[0]), this.getNext()!.parse(subfields[1]));
	}
}
class AtomParser extends Parser {
	protected canHandle(field: string): boolean {
		if (field)
			return true;
		else
			return false;
	}
	protected handle(field: string): CronField {
		return new AtomField(field);
	}
}

enum Type {
	SECOND = 0,
	MINUTE,
	HOUR,
	DAY_OF_MONTH,
	MONTH,
	DAY_OF_WEEK,
	YEAR
}
const TRANS: Record<Type, string> = {
	[Type.SECOND]: "秒",
	[Type.MINUTE]: "分",
	[Type.HOUR]: "时",
	[Type.DAY_OF_MONTH]: "天",
	[Type.MONTH]: "月",
	[Type.DAY_OF_WEEK]: "周",
	[Type.YEAR]: "年",
}

interface FieldVisitor {
	visitAtom(field: AtomField, type: Type): string;
	visitRange(field: RangeField, type: Type): string;
	visitStep(field: StepField, type: Type): string;
	visitList(field: ListField, type: Type): string;
}

export class CronTranslator implements FieldVisitor {
	visitAtom(field: AtomField, type: Type): string {
		if (field.value === "?") {
			return "";
		}
		if (field.value === "*") {
			return `每${TRANS[type]}`;
		}
		switch (type) {
			case Type.DAY_OF_MONTH: {
				if (field.value === "L")
					return "最后一天";
				else if (field.value === "LW")
					return "最后一个工作日";
				else if (field.value.endsWith("W"))
					return `最靠近${field.value.slice(0, -1)}的工作日`;
				else
					return `${field.value}号`;
			}
			case Type.DAY_OF_WEEK: {
				const WEEKTRANS: Record<string, string> = {
					"MON": "周一",
					"TUE": "周二",
					"WED": "周三",
					"THU": "周四",
					"FRI": "周五",
					"SAT": "周六",
					"SUN": "周日",

					"1": "周日",
					"2": "周一",
					"3": "周二",
					"4": "周三",
					"5": "周四",
					"6": "周五",
					"7": "周六",
				}
				if (field.value.includes("#")) {
					const parts = field.value.split("#");
					return `第${parts[1]}个${WEEKTRANS[parts[0]]}`;
				}
				else if (field.value.endsWith("L")) {
					return `最后一个${WEEKTRANS[field.value.slice(0, -1)]}`;
				}
				else
					return `${WEEKTRANS[field.value]}`;
			}
			case Type.MONTH: {
				const MONTHTRANS: Record<string, string> = {
					"JAN": "1月",
					"FEB": "2月",
					"MAR": "3月",
					"APR": "4月",
					"MAY": "5月",
					"JUN": "6月",
					"JUL": "7月",
					"AUG": "8月",
					"SEP": "9月",
					"OCT": "10月",
					"NOV": "11月",
					"DEC": "12月",

					"1": "1月",
					"2": "2月",
					"3": "3月",
					"4": "4月",
					"5": "5月",
					"6": "6月",
					"7": "7月",
					"8": "8月",
					"9": "9月",
					"10": "10月",
					"11": "11月",
					"12": "12月",
				};

				return `${MONTHTRANS[field.value]}`;
			}
			default:
				return `${field.value}${TRANS[type]}`;
		}
	}
	visitRange(field: RangeField, type: Type): string {
		return `${field.start.accept(this, type)}到${field.end.accept(this, type)} `;
	}
	visitStep(field: StepField, type: Type): string {
		if (field.base instanceof AtomField) {
			if (field.base.value === "*")
				return `每${field.step}${TRANS[type]}`;
			else
				return `从${field.base.accept(this, type)}起每隔${field.step}${TRANS[type]}`
		}
		else
			return `从${field.base.accept(this, type)}每隔${field.step}${TRANS[type]}`;
	}
	visitList(field: ListField, type: Type): string {
		let result: string = field.items[0].accept(this, type);
		for (let i: number = 1; i < field.items.length; i++) {
			result = result + ";" + field.items[i].accept(this, type);
		}
		result = result.replace(/\s/g, "");
		result = " " + result + " ";
		return result;
	}

	public translate(cron: string): string {
		const parser: Parser = new ListParser();
		parser.setNext(new StepParser()).setNext(new RangeParser()).setNext(new AtomParser());
		const expr: CronExpression = new CronExpression(cron, parser);

		let result: string = "";
		//本来是应该写成这样的 但是quartz cron比较别扭 dayofweek在month后面,这样就不能按顺序解析了,只能手动换个位置
		// for (let i: number = expr.fields.length - 1; i >= 0; i--) {
		// 	result += expr.fields[i].accept(this, i as Type);
		// }
		let temp: string = "";
		for (let i: number = expr.fields.length - 1; i >= 0; i--) {
			//假设是dayofweek 先存起来一会放到month前面
			if (i === Type.DAY_OF_WEEK) {
				temp = expr.fields[i].accept(this, i as Type);
			}
			else {
				result = result + expr.fields[i].accept(this, i) + temp;
				//用完置空
				temp = "";
			}
		}

		return result;
	}
}
